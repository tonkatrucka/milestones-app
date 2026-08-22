import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickImageOptions {
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

function buildPickerOptions(options: PickImageOptions): ImagePicker.ImagePickerOptions {
  const base: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: options.quality ?? 0.8,
    allowsEditing: options.allowsEditing ?? false,
  };

  if (options.aspect) {
    base.aspect = options.aspect;
  }

  if (options.allowsMultipleSelection) {
    base.allowsMultipleSelection = true;
    if (options.selectionLimit != null) {
      base.selectionLimit = options.selectionLimit;
    }
  }

  return base;
}

async function requestLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow Milestones to access your photos.');
    return false;
  }
  return true;
}

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow Milestones to use the camera.');
    return false;
  }
  return true;
}

export async function pickImageFromLibrary(options: PickImageOptions = {}): Promise<string[] | null> {
  if (!(await requestLibraryPermission())) return null;

  const result = await ImagePicker.launchImageLibraryAsync(buildPickerOptions(options));
  if (result.canceled) return null;
  return result.assets.map((asset) => asset.uri);
}

export async function pickImageFromCamera(options: PickImageOptions = {}): Promise<string[] | null> {
  if (!(await requestCameraPermission())) return null;

  const { allowsMultipleSelection: _multi, selectionLimit: _limit, ...cameraOptions } = options;
  const result = await ImagePicker.launchCameraAsync(buildPickerOptions(cameraOptions));
  if (result.canceled) return null;
  return [result.assets[0].uri];
}

type PickerAction = 'camera' | 'library' | 'cancel';

/** Prompt to take a photo or choose from the library; returns local URIs or null if cancelled. */
export function pickImage(options: PickImageOptions = {}): Promise<string[] | null> {
  if (Platform.OS === 'web') {
    return pickImageFromLibrary(options);
  }

  return new Promise((resolve) => {
    let action: PickerAction | null = null;
    let started = false;

    const run = (chosen: PickerAction) => {
      if (started) return;
      started = true;
      if (chosen === 'camera') {
        void pickImageFromCamera(options).then(resolve);
        return;
      }
      if (chosen === 'library') {
        void pickImageFromLibrary(options).then(resolve);
        return;
      }
      resolve(null);
    };

    Alert.alert(
      'Add photo',
      undefined,
      [
        {
          text: 'Take Photo',
          onPress: () => {
            action = 'camera';
            if (Platform.OS === 'android') {
              setTimeout(() => run('camera'), 350);
            } else {
              run('camera');
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            action = 'library';
            if (Platform.OS === 'android') {
              setTimeout(() => run('library'), 350);
            } else {
              run('library');
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            action = 'cancel';
            if (Platform.OS === 'android') {
              setTimeout(() => run('cancel'), 350);
            } else {
              run('cancel');
            }
          },
        },
      ],
      {
        cancelable: true,
        // Android fires onDismiss for button presses too. Only treat it as
        // cancel when no button recorded a choice.
        onDismiss: () => {
          setTimeout(() => {
            if (!started && action == null) run('cancel');
          }, Platform.OS === 'android' ? 450 : 0);
        },
      },
    );
  });
}
