import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";

// Si déjà connecté, on ne reste pas sur les écrans d'auth.
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
