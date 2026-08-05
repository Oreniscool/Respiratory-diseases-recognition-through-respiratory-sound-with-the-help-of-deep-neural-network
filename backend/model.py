from tensorflow.keras.layers import (
    Bidirectional,
    Conv1D,
    Dense,
    Dropout,
    GRU,
    LeakyReLU,
    Layer,
    LayerNormalization,
)
import tensorflow as tf


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

    """

    Architecture of the Deep Learning Model.

    Args:

        in_: input tensor shape
        num_classes: number of output classes

    Returns: Tensor model

    """
    # Layer normalization leaves all-zero padding untouched. The same mask is
    # passed to both GRUs and the pooling layer, preventing padded frames from
    # contributing to recurrent state or the final average.
    mask = FeatureValidityMask()(in_)
    x = LayerNormalization()(in_)

    l2_reg = tf.keras.regularizers.l2(1e-4)
    x = Conv1D(64, kernel_size=5, padding='same', activation=None, kernel_regularizer=l2_reg)(x)
    x = LeakyReLU()(x)
    x = Dropout(0.2)(x)

    x = Conv1D(64, kernel_size=3, padding='same', activation=None, kernel_regularizer=l2_reg)(x)
    x = LeakyReLU()(x)
    x = Dropout(0.2)(x)

    x = Bidirectional(GRU(64, return_sequences=True, activation=None, kernel_regularizer=l2_reg))(x, mask=mask)
    x = LeakyReLU()(x)
    x = Dropout(0.3)(x)

    x = Bidirectional(GRU(32, return_sequences=True, activation=None, kernel_regularizer=l2_reg))(x, mask=mask)
    x = LeakyReLU()(x)

    x = MaskedGlobalAveragePooling1D()([x, mask])
    x = Dense(64, activation=None, kernel_regularizer=l2_reg)(x)
    x = LeakyReLU()(x)
    x = Dropout(0.4)(x)

    output = Dense(num_classes, activation="softmax", kernel_regularizer=l2_reg)(x)

    return output


# Backwards-compatible name for older notebooks/scripts.
InstantiateModel = instantiate_model
