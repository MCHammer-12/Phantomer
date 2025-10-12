import { useState } from "react";

// Single-select chip input for string options
interface ChipInputProps {
  options: string[];
  selectedValue: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ChipInput({
  options,
  selectedValue,
  onChange,
  placeholder = "Select..."
}: ChipInputProps) {
  return (
    <div className="w-full">
      {selectedValue ? null : (
        <div className="mb-2 text-sm text-muted-foreground">{placeholder}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors 
              ${selectedValue === option
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// Single-select chip input for number options
interface NumberChipInputProps {
  min: number;
  max: number;
  selectedValue: number | null;
  onChange: (value: number) => void;
  placeholder?: string;
}

export function NumberChipInput({
  min,
  max,
  selectedValue,
  onChange,
  placeholder = "Select a number..."
}: NumberChipInputProps) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="w-full">
      {selectedValue ? null : (
        <div className="mb-2 text-sm text-muted-foreground">{placeholder}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`px-3 py-2 rounded-md text-sm font-medium text-center transition-colors 
              ${selectedValue === option
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// Multi-select tag chip input
interface TagChipInputProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagChipInput({
  options,
  selectedValues,
  onChange,
  placeholder = "Select tags..."
}: TagChipInputProps) {
  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      // Remove option
      onChange(selectedValues.filter((value) => value !== option));
    } else {
      // Add option
      onChange([...selectedValues, option]);
    }
  };

  return (
    <div className="w-full">
      {selectedValues.length === 0 && (
        <div className="mb-2 text-sm text-muted-foreground">{placeholder}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors 
              ${selectedValues.includes(option)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            onClick={() => toggleOption(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}