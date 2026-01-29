import { useState } from 'react'

type ThemeColors = {
  bg: string
  bgEnd: string
  panel: string
  card: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentHover: string
}

type ThemeBuilderProps = {
  onApply: (css: string) => void
  onCancel: () => void
}

const defaultColors: ThemeColors = {
  bg: '#0f1116',
  bgEnd: '#0b0d12',
  panel: '#171a22',
  card: '#1f2430',
  border: '#2f3a4f',
  text: '#f4f6fb',
  textMuted: '#c5ccda',
  accent: '#ff7a1a',
  accentHover: '#ff9a43'
}

export default function ThemeBuilder({ onApply, onCancel }: ThemeBuilderProps) {
  const [colors, setColors] = useState<ThemeColors>(defaultColors)

  const updateColor = (key: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }))
  }

  const generateCSS = () => {
    return `:root {
  --bg: ${colors.bg};
  --bg-end: ${colors.bgEnd};
  --panel: ${colors.panel};
  --card: ${colors.card};
  --card-2: ${adjustBrightness(colors.card, 1.1)};
  --border: ${colors.border};
  --text: ${colors.text};
  --text-muted: ${colors.textMuted};
  --text-dim: ${adjustBrightness(colors.textMuted, 0.7)};
  --accent: ${colors.accent};
  --accent-hover: ${colors.accentHover};
  --accent-contrast: ${adjustBrightness(colors.accent, 0.15)};
  --focus-ring: ${hexToRgba(colors.accentHover, 0.45)};
}`
  }

  const handleApply = () => {
    onApply(generateCSS())
  }

  const resetToDefaults = () => {
    setColors(defaultColors)
  }

  return (
    <div className="theme-builder">
      <div className="theme-builder-content">
        <div className="theme-builder-section">
          <h4>Background</h4>
          <ColorInput label="Background Start" value={colors.bg} onChange={(v) => updateColor('bg', v)} />
          <ColorInput label="Background End" value={colors.bgEnd} onChange={(v) => updateColor('bgEnd', v)} />

          <h4>Surfaces</h4>
          <ColorInput label="Panel" value={colors.panel} onChange={(v) => updateColor('panel', v)} />
          <ColorInput label="Card" value={colors.card} onChange={(v) => updateColor('card', v)} />
          <ColorInput label="Border" value={colors.border} onChange={(v) => updateColor('border', v)} />

          <h4>Text</h4>
          <ColorInput label="Primary Text" value={colors.text} onChange={(v) => updateColor('text', v)} />
          <ColorInput label="Secondary Text" value={colors.textMuted} onChange={(v) => updateColor('textMuted', v)} />

          <h4>Accent</h4>
          <ColorInput label="Accent Color" value={colors.accent} onChange={(v) => updateColor('accent', v)} />
          <ColorInput label="Accent Hover" value={colors.accentHover} onChange={(v) => updateColor('accentHover', v)} />
        </div>
      </div>

      <div className="theme-builder-preview">
        <h4>Preview</h4>
        <div className="preview-card" style={{
          background: `linear-gradient(135deg, ${colors.bg}, ${colors.bgEnd})`,
          border: `1px solid ${colors.border}`,
          padding: '16px',
          borderRadius: '8px'
        }}>
          <div style={{
            background: colors.card,
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '12px'
          }}>
            <p style={{ color: colors.text, margin: '0 0 8px 0', fontWeight: 600 }}>
              Preview Card
            </p>
            <p style={{ color: colors.textMuted, margin: 0, fontSize: '14px' }}>
              Secondary text looks like this
            </p>
          </div>
          <button style={{
            background: colors.accent,
            color: colors.text,
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500
          }}>
            Accent Button
          </button>
        </div>
      </div>

      <div className="theme-builder-actions">
        <button className="btn ghost" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
        <button className="btn outline" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={handleApply}>
          Apply Theme
        </button>
      </div>
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="color-input">
      <label>
        <span>{label}</span>
        <div className="color-input-row">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            pattern="^#[0-9A-Fa-f]{6}$"
            placeholder="#000000"
          />
        </div>
      </label>
    </div>
  )
}

// Utility functions
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function adjustBrightness(hex: string, factor: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor))
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor))
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
