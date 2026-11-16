import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsForm from '../../src/components/SettingsForm';
import { makeSession } from '../helpers/fixtures';

describe('SettingsForm', () => {
  it('UT-UI-SET-01 選純速度 → 隱藏 settings-window-sec', async () => {
    render(<SettingsForm session={makeSession({ fairnessMode: 'fair' })} onSave={vi.fn()} />);
    expect(screen.getByTestId('settings-window-sec')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('settings-mode-speed'));
    expect(screen.queryByTestId('settings-window-sec')).not.toBeInTheDocument();
  });

  it('UT-UI-SET-02 輸入組數 25 → settings-save disabled', async () => {
    const onSave = vi.fn();
    render(<SettingsForm session={makeSession()} onSave={onSave} />);
    expect(screen.getByTestId('settings-save')).toBeEnabled();

    const input = screen.getByTestId('settings-team-count');
    await userEvent.clear(input);
    await userEvent.type(input, '25');

    expect(screen.getByTestId('settings-save')).toBeDisabled();
    await userEvent.click(screen.getByTestId('settings-save'));
    expect(onSave).not.toHaveBeenCalled();
  });
});
