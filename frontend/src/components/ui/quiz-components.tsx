"use client"

import React from 'react'

interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ value, onValueChange, children }) => {
  // Pass the onValueChange function to children
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { 
        isSelected: child.props.value === value,
        onSelect: () => onValueChange(child.props.value)
      });
    }
    return child;
  });

  return (
    <div className="space-y-2">
      {childrenWithProps}
    </div>
  );
}

interface RadioGroupItemProps {
  value: string
  id: string
  isSelected?: boolean
  onSelect?: () => void
}

export const RadioGroupItem: React.FC<RadioGroupItemProps> = ({ 
  value, 
  id, 
  isSelected = false,
  onSelect = () => {}
}) => (
  <input 
    type="radio" 
    value={value} 
    id={id} 
    checked={isSelected}
    onChange={onSelect}
    className="w-4 h-4"
  />
)

interface ProgressProps {
  value: number
  className?: string
}

export const Progress: React.FC<ProgressProps> = ({ value, className }) => (
  <div className={`bg-gray-200 rounded-full ${className || ''}`}>
    <div 
      className="bg-primary rounded-full h-full" 
      style={{ width: `${value}%` }}
    />
  </div>
) 