// Bottom-sheet réutilisable — Modal RN natif (slide bas), sans dépendance.
// Scrim cliquable + panneau arrondi haut + safe-area bas.
import { type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function BottomSheet({
  visible,
  onClose,
  children,
  /** Hauteur fixe en % de l'écran (ex. 80). Sinon : auto, plafonné à 85%. */
  heightPct,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  heightPct?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityLabel="Fermer"
      />
      <View
        className="rounded-t-3xl bg-ivory px-5 pt-3"
        style={{
          paddingBottom: insets.bottom + 16,
          ...(heightPct
            ? { height: `${heightPct}%` as const }
            : { maxHeight: "85%" as const }),
        }}
      >
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-ink-5" />
        {children}
      </View>
    </Modal>
  );
}
