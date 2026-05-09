from keras.layers import Input, BatchNormalization, GRU, Dense, Dropout, LeakyReLU, Bidirectional, Conv1D, GlobalAveragePooling1D
from keras.models import Model, load_model

def InstantiateModel(in_, num_classes):

    """

    Architecture of the Deep Learning Model.

    Args:

        in_: input tensor shape
        num_classes: number of output classes

    Returns: Tensor model

    """
    x = BatchNormalization()(in_)

    x = Conv1D(64, kernel_size=5, padding='same', activation=None)(x)
    x = LeakyReLU()(x)
    x = Dropout(0.2)(x)

    x = Conv1D(64, kernel_size=3, padding='same', activation=None)(x)
    x = LeakyReLU()(x)
    x = Dropout(0.2)(x)

    x = Bidirectional(GRU(64, return_sequences=True, activation=None))(x)
    x = LeakyReLU()(x)
    x = Dropout(0.3)(x)

    x = Bidirectional(GRU(32, return_sequences=True, activation=None))(x)
    x = LeakyReLU()(x)

    x = GlobalAveragePooling1D()(x)
    x = Dense(64, activation=None)(x)
    x = LeakyReLU()(x)
    x = Dropout(0.4)(x)

    output = Dense(num_classes, activation="softmax")(x)

    return output