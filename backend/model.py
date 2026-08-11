from tensorflow.keras.layers import (
    Bidirectional,
    Conv1D,
    Dense,
    Dropout,
    GRU,
    Layer,
    LayerNormalization,
    SpatialDropout1D,
    Activation,
)
import tensorflow as tf

# ------------------------------------------------------------
# New utility layers for RespiNet‑Attention v2
# ------------------------------------------------------------

class SqueezeExcitation1D(Layer):
    """Channel‑wise squeeze‑excitation for 1‑D sequences.

    The block performs global average pooling over the temporal dimension,
    passes the result through a bottleneck (reduction factor 4) and then
    rescales the original feature map.  This allows the network to adaptively
    emphasize frequency bands that are most informative for respiratory
    pathology.
    """

    def __init__(self, reduction: int = 4, **kwargs):
        super().__init__(**kwargs)
        self.reduction = reduction
        self.global_avg = tf.keras.layers.GlobalAveragePooling1D(keepdims=True)
        self.dense1 = None  # will be built lazily
        self.dense2 = None

    def build(self, input_shape):
        channel_dim = input_shape[-1]
        reduced_dim = max(1, channel_dim // self.reduction)
        self.dense1 = tf.keras.layers.Dense(
            reduced_dim, activation="relu", kernel_initializer="he_normal"
        )
        self.dense2 = tf.keras.layers.Dense(
            channel_dim, activation="sigmoid", kernel_initializer="he_normal"
        )
        super().build(input_shape)

    def call(self, inputs):
        # inputs: (batch, time, channels)
        squeeze = self.global_avg(inputs)  # (batch, 1, channels)
        excitation = self.dense1(squeeze)
        excitation = self.dense2(excitation)
        return inputs * excitation  # broadcasting over time dimension

    def get_config(self):
        config = super().get_config()
        config.update({"reduction": self.reduction})
        return config


class MultiScaleConvBlock(Layer):
    """Parallel convolutions with different receptive fields followed by SE.

    Implements three Conv1D branches (kernel sizes 3, 5, 11) each producing
    `filters // 3` output channels.  The concatenated tensor passes through a
    `SqueezeExcitation1D` block and a spatial dropout.
    """

    def __init__(self, filters: int = 96, kernel_sizes: tuple[int, ...] = (3, 5, 11), dropout: float = 0.2, l2_reg: float = 1e-3, **kwargs):
        super().__init__(**kwargs)
        self.filters = filters
        self.kernel_sizes = kernel_sizes
        self.dropout = dropout
        self.l2_reg = tf.keras.regularizers.l2(l2_reg)
        self.branches = []
        self.se = SqueezeExcitation1D()
        self.spatial_dropout = SpatialDropout1D(self.dropout)

    def build(self, input_shape):
        per_branch = self.filters // len(self.kernel_sizes)
        for k in self.kernel_sizes:
            conv = Conv1D(
                per_branch,
                kernel_size=k,
                padding="same",
                activation=None,
                kernel_regularizer=self.l2_reg,
            )
            self.branches.append(conv)
        super().build(input_shape)

    def call(self, inputs):
        # Apply each branch, then GELU activation
        branch_outputs = []
        for conv in self.branches:
            x = conv(inputs)
            x = tf.keras.activations.gelu(x)
            branch_outputs.append(x)
        x = tf.concat(branch_outputs, axis=-1)
        x = self.se(x)
        x = self.spatial_dropout(x)
        return x

    def get_config(self):
        config = super().get_config()
        config.update({
            "filters": self.filters,
            "kernel_sizes": self.kernel_sizes,
            "dropout": self.dropout,
            "l2_reg": self.l2_reg.l2,
        })
        return config


class MaskedSelfAttentivePooling1D(Layer):
    """Masked self‑attention pooling over the time dimension.

    Accepts a tuple ``[sequence, mask]`` where ``mask`` is a boolean tensor of
    shape ``(batch, time)`` indicating valid timesteps (produced by
    ``FeatureValidityMask``).  The layer learns a soft attention distribution
    only over valid frames and returns a fixed‑size context vector.
    """

    def __init__(self, attn_units: int = 128, **kwargs):
        super().__init__(**kwargs)
        self.attn_units = attn_units
        self.dense_tanh = None
        self.dense_score = None

    def build(self, input_shape):
        # ``input_shape`` is a list: [seq_shape, mask_shape]
        seq_shape = input_shape[0]
        hidden_dim = seq_shape[-1]
        self.dense_tanh = tf.keras.layers.Dense(self.attn_units, activation="tanh")
        self.dense_score = tf.keras.layers.Dense(1, use_bias=False)
        super().build(input_shape)

    def call(self, inputs, mask=None):
        # ``inputs`` is a list ``[sequence, mask]``
        sequence, validity = inputs
        # Compute attention scores
        h = self.dense_tanh(sequence)  # (batch, time, attn_units)
        scores = self.dense_score(h)  # (batch, time, 1)
        # Apply mask (mask is bool; convert to float)
        validity = tf.cast(validity, tf.float32)[..., tf.newaxis]
        large_neg = -1e9
        scores = scores + (1.0 - validity) * large_neg
        alphas = tf.nn.softmax(scores, axis=1)  # (batch, time, 1)
        # Weighted sum
        context = tf.reduce_sum(sequence * alphas, axis=1)  # (batch, hidden)
        return context

    def compute_output_shape(self, input_shape):
        return (input_shape[0][0], input_shape[0][-1])

    def get_config(self):
        config = super().get_config()
        config.update({"attn_units": self.attn_units})
        return config

# ------------------------------------------------------------
# Existing custom layers (unchanged) – FeatureValidityMask & MaskedGlobalAveragePooling1D
# ------------------------------------------------------------



@tf.keras.utils.register_keras_serializable(package="respinet")
class FeatureValidityMask(Layer):
    """Identify non-padding timesteps from the raw feature input."""

    def call(self, inputs):
        return tf.reduce_any(tf.not_equal(inputs, 0.0), axis=-1)


@tf.keras.utils.register_keras_serializable(package="respinet")
class MaskedGlobalAveragePooling1D(Layer):
    """Average sequence activations using the validity mask derived from input."""

    def call(self, inputs):
        sequence, mask = inputs
        weights = tf.cast(mask, sequence.dtype)[..., tf.newaxis]
        total = tf.reduce_sum(sequence * weights, axis=1)
        count = tf.maximum(tf.reduce_sum(weights, axis=1), tf.constant(1.0, sequence.dtype))
        return total / count

def instantiate_model(in_, num_classes):
    """Architecture of the Deep Learning Model (RespiNet‑Attention v2)."""
    # Validity mask for zero‑padded frames
    mask = FeatureValidityMask()(in_)
    x = LayerNormalization()(in_)

    # Multi‑scale convolution block with squeeze‑excitation
    x = MultiScaleConvBlock()(x)

    # Residual Bi‑GRU backbone (keeps mask for padded frames)
    gru1 = Bidirectional(
        GRU(64, return_sequences=True, activation=None, kernel_regularizer=tf.keras.regularizers.l2(1e-3))
    )(x, mask=mask)
    gru1 = tf.keras.activations.gelu(gru1)
    gru1 = Dropout(0.3)(gru1)

    gru2 = Bidirectional(
        GRU(32, return_sequences=True, activation=None, kernel_regularizer=tf.keras.regularizers.l2(1e-3))
    )(gru1, mask=mask)
    gru2 = tf.keras.activations.gelu(gru2)

    # Masked self‑attentive temporal pooling replaces uniform averaging
    x = MaskedSelfAttentivePooling1D()([gru2, mask])

    # Classification head
    x = Dense(64, activation=None, kernel_regularizer=tf.keras.regularizers.l2(1e-3))(x)
    x = tf.keras.activations.gelu(x)
    x = Dropout(0.4)(x)

    output = Dense(num_classes, activation="softmax", kernel_regularizer=tf.keras.regularizers.l2(1e-3))(x)

    return output


# Backwards-compatible name for older notebooks/scripts.
InstantiateModel = instantiate_model
