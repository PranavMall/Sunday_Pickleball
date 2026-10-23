// The app's ONE text component. Game screens ignore the phone's font-size
// setting (allowFontScaling={false}); React 19 dropped defaultProps on function
// components, so a shared component is the reliable way on RN 0.86.
//
// Never "…": any Text given numberOfLines (capped at 2) shrinks to fit
// (adjustsFontSizeToFit, minimumFontScale 0.75) and clips instead of ellipsizing.
import React from "react";
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from "react-native";

export const Text = React.forwardRef<RNText, TextProps>(function Text({ numberOfLines, ...rest }, ref) {
  if (numberOfLines)
    return (
      <RNText
        ref={ref}
        allowFontScaling={false}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        ellipsizeMode="clip"
        {...rest}
        numberOfLines={Math.min(numberOfLines, 2)}
      />
    );
  return <RNText ref={ref} allowFontScaling={false} {...rest} />;
});

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput ref={ref} allowFontScaling={false} {...props} />;
});
