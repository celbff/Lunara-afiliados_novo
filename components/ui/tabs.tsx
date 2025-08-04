// components/ui/Tabs.tsx - Componente Tabs UI
'use client'

import React, { createContext, useContext, useState } from 'react'

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function Tabs({ 
  value, 
  onValueChange, 
  children, 
  className = '',
  orientation = 'horizontal'
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div 
        className={`${className}`}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className}`}>
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function TabsTrigger({ 
  value, 
  children, 
  className = '',
  disabled = false
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext()
  const isSelected = selectedValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all 
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
        disabled:pointer-events-none disabled:opacity-50
        ${isSelected 
          ? 'bg-background text-foreground shadow-sm' 
          : 'hover:bg-background/80 hover:text-foreground'
        }
        ${className}
      `}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ 
  value, 
  children, 
  className = ''
}: TabsContentProps) {
  const { value: selectedValue } = useTabsContext()
  const isSelected = selectedValue === value

  if (!isSelected) {
    return null
  }

  return (
    <div
      role="tabpanel"
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  )
}