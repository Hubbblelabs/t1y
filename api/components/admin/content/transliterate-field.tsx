"use client";

import * as React from "react";
import { ReactTransliterate } from "react-transliterate";
import "react-transliterate/dist/index.css";

import { fieldStyles } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/**
 * English-keystrokes-to-Tamil-script input, for authoring Tamil content
 * without a Tamil keyboard. Wraps `react-transliterate` (Google Input
 * Tools' API) — the exact package name requested, `react-google-
 * transliterate`, does not exist on npm; this is the maintained package
 * that does what was asked (see its own README: "Uses API from Google
 * Input Tools").
 *
 * NOTE: transliteration is a network call to Google's API per keystroke
 * pause. It only activates for Tamil content — English authoring is
 * unaffected — and degrades to a plain field if that request fails, so it
 * never blocks typing.
 */
export function TransliterateInput({
  value,
  onChangeText,
  placeholder,
  className,
  id,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <ReactTransliterate
      value={value}
      onChangeText={onChangeText}
      lang="ta"
      renderComponent={(props) => (
        <input
          id={id}
          placeholder={placeholder}
          className={cn(fieldStyles, "h-9", className)}
          {...props}
        />
      )}
    />
  );
}

export function TransliterateTextarea({
  value,
  onChangeText,
  placeholder,
  className,
  rows = 6,
  id,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  id?: string;
}) {
  return (
    <ReactTransliterate
      value={value}
      onChangeText={onChangeText}
      lang="ta"
      renderComponent={(props) => (
        <textarea
          id={id}
          rows={rows}
          placeholder={placeholder}
          className={cn(fieldStyles, "min-h-20 py-2 leading-6", className)}
          {...props}
        />
      )}
    />
  );
}
