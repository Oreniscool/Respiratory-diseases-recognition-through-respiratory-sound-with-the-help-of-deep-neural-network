from keras import backend as K
from model import InstantiateModel
from keras.models import Model
from keras.optimizers import Adamax
from keras.layers import Input
from keras.callbacks import EarlyStopping, ModelCheckpoint

def trainModel(X, y, healthy_class_index=None, healthy_class_multiplier=1.0):

    """

    Training the Neural Network model against the data.

    Args:

        X: Array of features to be trained.

        y: Array of Target attribute.

    Returns: Save Trained model weights.

    """

    K.clear_session()

    batch_size = X.shape[0]

    time_steps = X.shape[1]

    data_dim = X.shape[2]
    num_classes = y.shape[1]

    Input_Sample = Input(shape=(time_steps, data_dim))

    Output_ = InstantiateModel(Input_Sample, num_classes)

    Model_Enhancer = Model(inputs=Input_Sample, outputs=Output_)

    Model_Enhancer.compile(loss='categorical_crossentropy', metrics=['accuracy'], optimizer=Adamax(learning_rate=1e-3))

    ES = EarlyStopping(monitor='val_loss', min_delta=0.001, patience=10, verbose=1, mode='auto', baseline=None,

                       restore_best_weights=True)

    MC = ModelCheckpoint('best_model.h5', monitor='val_accuracy', mode='max', verbose=0, save_best_only=True)

    import numpy as np
    from sklearn.utils import class_weight
    
    y_integers = np.argmax(y_train, axis=1)
    class_weights = class_weight.compute_class_weight(class_weight='balanced',
                                                      classes=np.unique(y_integers),
                                                      y=y_integers)
    class_weights_dict = dict(enumerate(class_weights))

    if healthy_class_index is not None and healthy_class_index in class_weights_dict:
        class_weights_dict[healthy_class_index] *= float(healthy_class_multiplier)

    ModelHistory = Model_Enhancer.fit(x_train, y_train, batch_size=num_batch_size, epochs=num_epochs,

                                      validation_data=(x_test, y_test),

                                      callbacks=[MC, ES],

                                      class_weight=class_weights_dict,

                                      verbose=1)
