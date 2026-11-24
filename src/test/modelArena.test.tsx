import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelArena from '../components/copilot/ModelArena';
import QuickAiHud from '../components/copilot/QuickAiHud';
import type { Settings, AvailableModel } from '../types';

const mockSettings: Settings = {
  provider: 'openai',
  theme: 'dark',
  systemPrompt: '',
  openaiBaseUrl: 'http://127.0.0.1:11434/v1',
  openaiApiKey: 'sk-local',
  openaiModel: 'qwen2.5:7b',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 16384,
  ttsVoice: '',
};

const mockModels: AvailableModel[] = [
  { id: 'qwen2.5:7b' },
  { id: 'deepseek-r1:8b' },
  { id: 'llama3.1:8b' },
];

describe('ModelArena component', () => {
  it('renders Challenger A and Challenger B model selectors', () => {
    render(
      <ModelArena
        availableModels={mockModels}
        currentModel="qwen2.5:7b"
        settings={mockSettings}
        onAdoptResponse={vi.fn()}
      />
    );

    expect(screen.getByText('Challenger A')).toBeTruthy();
    expect(screen.getByText('Challenger B')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Broadcast a security prompt/i)).toBeTruthy();
  });

  it('populates prompt when clicking a quick suggestion chip', () => {
    render(
      <ModelArena
        availableModels={mockModels}
        currentModel="qwen2.5:7b"
        settings={mockSettings}
        onAdoptResponse={vi.fn()}
      />
    );

    const chip = screen.getByText(/authenticated blind SQL injection/i);
    fireEvent.click(chip);

    const textarea = screen.getByPlaceholderText(/Broadcast a security prompt/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('authenticated blind SQL injection');
  });
});

describe('QuickAiHud component', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <QuickAiHud
        isOpen={false}
        onClose={vi.fn()}
        settings={mockSettings}
        onOpenFullCopilotWithPrompt={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders input with ESC badge when open', () => {
    render(
      <QuickAiHud
        isOpen={true}
        onClose={vi.fn()}
        settings={mockSettings}
        onOpenFullCopilotWithPrompt={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/Ask AI anything/i)).toBeTruthy();
    expect(screen.getByText('ESC')).toBeTruthy();
    expect(screen.getByText('Explain Vulnerability')).toBeTruthy();
  });

  it('calls onClose on ESC keydown', () => {
    const handleClose = vi.fn();
    render(
      <QuickAiHud
        isOpen={true}
        onClose={handleClose}
        settings={mockSettings}
        onOpenFullCopilotWithPrompt={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });
});
