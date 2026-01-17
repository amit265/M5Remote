import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

const RemoteButton = ({
  label,
  onPress,
  style,
  textStyle,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.buttonText, textStyle]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default RemoteButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    flex: 1,
    minHeight: 56,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.4,
  },
});
