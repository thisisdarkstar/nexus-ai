import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomSelect, { SelectOption } from '../components/common/CustomSelect';

describe('CustomSelect component', () => {
  it('renders trigger with selected value label', () => {
    const options: SelectOption[] = [
      { value: 'thread-1', label: 'Thread 1' },
      { value: 'thread-2', label: 'Thread 2' },
    ];

    render(
      <CustomSelect
        value="thread-1"
        onChange={vi.fn()}
        options={options}
      />
    );

    expect(screen.getByRole('button').textContent).toContain('Thread 1');
  });

  it('opens menu and selects option on click', () => {
    const handleChange = vi.fn();
    const options: SelectOption[] = [
      { value: 'thread-1', label: 'Thread 1' },
      { value: 'thread-2', label: 'Thread 2' },
    ];

    render(
      <CustomSelect
        value="thread-1"
        onChange={handleChange}
        options={options}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeTruthy();

    // Click second option
    const optionItems = screen.getAllByRole('option');
    expect(optionItems).toHaveLength(2);
    fireEvent.click(optionItems[1]);

    expect(handleChange).toHaveBeenCalledWith('thread-2');
  });

  it('triggers onAction callback without firing onChange when action button is clicked', () => {
    const handleChange = vi.fn();
    const handleAction = vi.fn();

    const options: SelectOption[] = [
      {
        value: 'thread-1',
        label: 'Thread 1',
        onAction: handleAction,
        actionTitle: 'Delete Thread',
      },
      { value: 'thread-2', label: 'Thread 2' },
    ];

    render(
      <CustomSelect
        value="thread-1"
        onChange={handleChange}
        options={options}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Find action button by title
    const actionBtn = screen.getByTitle('Delete Thread');
    expect(actionBtn).toBeTruthy();

    // Click delete action
    fireEvent.click(actionBtn);

    expect(handleAction).toHaveBeenCalledWith('thread-1');
    expect(handleChange).not.toHaveBeenCalled();
    // Dropdown should close after action
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
