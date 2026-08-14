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
    Add,
)
import tensorflow as tf

# ============================================================
# RespiNet-Attention v3
#
# Architecture changes over v2:
#   1. Dual Temporal Pooling: MaskedDualTemporalPooling1D replaces
#      single tanh self-attention. Concatenates a soft attentive
#      context vector (for sustained wheezes / rhonchi) with a
#      masked max-pooled vector (for short crackle transients),
#      doubling the expressiveness of the pooling stage.
#   2. Residual skip connections: A point-wise Conv1D projection
#      aligns the MultiScaleConvBlock output channels with gru1's
#      output width and adds them element-wise before gru2. This
#      preserves high-frequency local texture across the recurrent
#      stack.
#   3. Scaled GRU capacity: Units raised from (64, 32) → (128, 64)
#      to give the model more representational headroom on the
#      Kaggle Asthma V2 dataset (~1 211 recordings, 5 classes).
#   4. Relaxed L2 regularization: Coefficient reduced from 1e-3
#      to 1e-4 across all Conv, GRU, and Dense layers; the
#      previous 1e-3 penalty contributed to the early underfitting
#      visible at Epoch 7 of the v2 run.
# ============================================================


# ------------------------------------------------------------
# Utility layers shared by v2 and v3
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


# ------------------------------------------------------------
# v3 utility layers
# ------------------------------------------------------------

@tf.keras.utils.register_keras_serializable(package="respinet")
class SqueezeExcitation1D(Layer):
    """Channel-wise squeeze-excitation for 1-D sequences.

    Global average pooling over the temporal dimension followed by a
    bottleneck (reduction factor 4) rescales the feature map so the
    network can emphasise frequency bands informative for each
    respiratory pathology.
    """

    def __init__(self, reduction: int = 4, **kwargs):
        super().__init__(**kwargs)
        self.reduction = reduction
        self.global_avg = tf.keras.layers.GlobalAveragePooling1D(keepdims=True)

    def build(self, input_shape):
        channel_dim = input_shape[-1]
        reduced_dim = max(1, channel_dim // self.reduction)
        self.dense1 = tf.keras.layers.Dense(
            reduced_dim, activation="relu", kernel_initializer="he_normal"
        )
        self.dense1.build((None, 1, channel_dim))
        self.dense2 = tf.keras.layers.Dense(
            channel_dim, activation="sigmoid", kernel_initializer="he_normal"
        )
        self.dense2.build((None, 1, reduced_dim))
        super().build(input_shape)

    def call(self, inputs):
        squeeze = self.global_avg(inputs)   # (batch, 1, channels)
        excitation = self.dense1(squeeze)
        excitation = self.dense2(excitation)
        return inputs * excitation           # broadcast over time

    def get_config(self):
        config = super().get_config()
        config.update({"reduction": self.reduction})
        return config


@tf.keras.utils.register_keras_serializable(package="respinet")
class MultiScaleConvBlock(Layer):
    """Parallel Conv1D branches (k=3, 5, 11) with SE recalibration.

    Each branch emits ``filters // 3`` channels, which are concatenated
    and fed through SqueezeExcitation1D + SpatialDropout1D.
    """

    def __init__(
        self,
        filters: int = 96,
        kernel_sizes: tuple[int, ...] = (3, 5, 11),
        dropout: float = 0.2,
        l2_reg: float = 1e-4,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.filters = filters
        self.kernel_sizes = tuple(kernel_sizes)
        self.dropout = dropout
        self.l2_reg_val = l2_reg
        self.l2_reg = tf.keras.regularizers.l2(l2_reg)
        self.se = SqueezeExcitation1D()
        self.spatial_dropout = SpatialDropout1D(self.dropout)

    def build(self, input_shape):
        per_branch = self.filters // len(self.kernel_sizes)
        self.branches = []
        for k in self.kernel_sizes:
            conv = Conv1D(
                per_branch,
                kernel_size=k,
                padding="same",
                activation=None,
                kernel_regularizer=self.l2_reg,
            )
            conv.build(input_shape)
            self.branches.append(conv)
        self.se.build((None, input_shape[1], self.filters))
        super().build(input_shape)

    def call(self, inputs):
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
            "l2_reg": self.l2_reg_val,
        })
        return config


@tf.keras.utils.register_keras_serializable(package="respinet")
class MaskedDualTemporalPooling1D(Layer):
    """Dual temporal pooling: soft attention + masked max-pooling.

    Soft attentive pooling captures sustained events (wheezes, rhonchi,
    bronchial breath sounds) by computing a learned weighted average
    over all valid frames.  Masked max-pooling captures the single most
    prominent activation in each channel, which is particularly
    sensitive to short, explosive crackle transients (<20 ms).

    The two context vectors are concatenated, doubling the width of the
    representation passed to the classification head.

    Parameters
    ----------
    attn_units : int
        Hidden units in the tanh attention projection (default 128).
    """

    def __init__(self, attn_units: int = 128, **kwargs):
        super().__init__(**kwargs)
        self.attn_units = attn_units

    def build(self, input_shape):
        seq_shape = input_shape[0] if isinstance(input_shape, (list, tuple)) else input_shape
        C = seq_shape[-1]
        self.dense_tanh = tf.keras.layers.Dense(self.attn_units, activation="tanh")
        self.dense_tanh.build((None, C))
        self.dense_score = tf.keras.layers.Dense(1, use_bias=False)
        self.dense_score.build((None, self.attn_units))
        super().build(input_shape)

    def call(self, inputs, mask=None):
        sequence, validity = inputs   # (batch, T, C), (batch, T)

        validity_float = tf.cast(validity, tf.float32)[..., tf.newaxis]  # (batch, T, 1)
        large_neg = -1e9

        # 1. Soft attentive pooling (captures continuous sounds)
        h = self.dense_tanh(sequence)                                    # (batch, T, attn_units)
        scores = self.dense_score(h)                                     # (batch, T, 1)
        scores = scores + (1.0 - validity_float) * large_neg
        alphas = tf.nn.softmax(scores, axis=1)                           # (batch, T, 1)
        soft_context = tf.reduce_sum(sequence * alphas, axis=1)          # (batch, C)

        # 2. Masked max-pooling (captures peak acoustic transients)
        masked_seq = sequence + large_neg * (1.0 - validity_float)      # (batch, T, C)
        max_context = tf.reduce_max(masked_seq, axis=1)                  # (batch, C)

        # Concatenate both pooling perspectives
        return tf.concat([soft_context, max_context], axis=-1)           # (batch, 2*C)

    def compute_output_shape(self, input_shape):
        seq_shape = input_shape[0]
        return (seq_shape[0], seq_shape[-1] * 2)

    def get_config(self):
        config = super().get_config()
        config.update({"attn_units": self.attn_units})
        return config


# ------------------------------------------------------------
# Model assembly
# ------------------------------------------------------------

def instantiate_model(in_, num_classes):
    """Architecture of the Deep Learning Model (RespiNet-Attention v3).

    Layer graph
    -----------
    Input → FeatureValidityMask
         → LayerNorm
         → MultiScaleConvBlock(filters=96, kernels=(3,5,11), l2=1e-4)
         ↓  (residual projection to 2*128 channels via Conv1D(256, k=1))
         → BiGRU(128) + GELU + Dropout(0.3)
         → residual add(projected_conv, gru1)
         → LayerNorm
         → BiGRU(64) + GELU
         → MaskedDualTemporalPooling1D → context(256,)
         → Dense(128) + GELU + Dropout(0.3)
         → Dense(64)  + GELU + Dropout(0.4)
         → Dense(num_classes, softmax)
    """
    l2 = tf.keras.regularizers.l2(1e-4)

    # Validity mask for zero-padded frames
    mask = FeatureValidityMask()(in_)

    x = LayerNormalization()(in_)

    # Multi-scale convolution block with squeeze-excitation
    conv_out = MultiScaleConvBlock(filters=96, kernel_sizes=(3, 5, 11), dropout=0.2, l2_reg=1e-4)(x)
    # conv_out shape: (batch, T, 96)

    # BiGRU layer 1 — 128 units → output width 256 (Bidirectional doubles)
    gru1 = Bidirectional(
        GRU(128, return_sequences=True, activation=None, kernel_regularizer=l2),
        name="bigru_1",
    )(conv_out, mask=mask)
    gru1 = tf.keras.activations.gelu(gru1)
    gru1 = Dropout(0.3)(gru1)
    # gru1 shape: (batch, T, 256)

    # Residual skip: project conv_out → 256 channels and add to gru1
    # This lets low-level spectral texture bypass the first recurrent layer.
    skip = Conv1D(256, kernel_size=1, padding="same", kernel_regularizer=l2, name="skip_proj")(conv_out)
    skip = LayerNormalization()(skip)
    gru1_residual = Add(name="residual_add")([gru1, skip])

    # BiGRU layer 2 — 64 units → output width 128 (Bidirectional doubles)
    gru2 = Bidirectional(
        GRU(64, return_sequences=True, activation=None, kernel_regularizer=l2),
        name="bigru_2",
    )(gru1_residual, mask=mask)
    gru2 = tf.keras.activations.gelu(gru2)
    # gru2 shape: (batch, T, 128)

    # Dual temporal pooling: soft attention + masked max-pooling
    # Output shape: (batch, 256)
    x = MaskedDualTemporalPooling1D(attn_units=128)([gru2, mask])

    # Classification head — two Dense layers with progressive dropout
    x = Dense(128, activation=None, kernel_regularizer=l2)(x)
    x = tf.keras.activations.gelu(x)
    x = Dropout(0.3)(x)

    x = Dense(64, activation=None, kernel_regularizer=l2)(x)
    x = tf.keras.activations.gelu(x)
    x = Dropout(0.4)(x)

    output = Dense(num_classes, activation="softmax", kernel_regularizer=l2)(x)

    return output


# Backwards-compatible alias for older notebooks/scripts.
InstantiateModel = instantiate_model
