import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Phase } from '@quiz/shared';
import ExportPanel from '../../src/components/ExportPanel';

function renderPanel(over: Partial<Parameters<typeof ExportPanel>[0]> = {}) {
  const props: Parameters<typeof ExportPanel>[0] = {
    phase: 'ENDED', busy: false,
    onExport: vi.fn(async () => 3),
    onRestore: vi.fn(async () => 6),
    onDownload: vi.fn(async () => undefined),
    ...over,
  };
  const utils = render(<ExportPanel {...props} />);
  return { ...utils, props };
}

function buttons() {
  return {
    exp: screen.getByTestId('btn-export-sheet'),
    restore: screen.getByTestId('btn-restore-sheet'),
    csv: screen.getByTestId('btn-download-csv'),
  };
}

describe('ExportPanel', () => {
  afterEach(cleanup);

  it('UT-UI-EXP-01 匯出成功 3 格 → export-result 顯示「已寫回 3 格」', async () => {
    const { props } = renderPanel();
    fireEvent.click(buttons().exp);
    expect(await screen.findByTestId('export-result')).toHaveTextContent('已寫回 3 格');
    expect(props.onExport).toHaveBeenCalledTimes(1);

    // 延伸斷言（plan D3；TEST_SPEC 補登 UT-UI-EXP-02 前依 research D3 置於此）：還原成功 6 格 →「已還原 6 格」
    fireEvent.click(buttons().restore);
    expect(await screen.findByText('已還原 6 格')).toBeInTheDocument();
    expect(screen.getByTestId('export-result')).toHaveTextContent('已還原 6 格');

    // 按下載 CSV → onDownload 被呼叫 1 次
    fireEvent.click(buttons().csv);
    expect(props.onDownload).toHaveBeenCalledTimes(1);
  });

  it('UT-UI-EXP-01 onExport reject → export-result 不顯示成功文字', async () => {
    const onExport = vi.fn(async (): Promise<number> => { throw { code: 'SHEETS_ERROR', message: 'x' }; });
    renderPanel({ onExport });
    fireEvent.click(buttons().exp);
    await vi.waitFor(() => expect(onExport).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText(/已寫回/)).not.toBeInTheDocument();
  });

  it.each<[Phase, boolean, boolean, boolean]>([
    // phase, export, restore, csv 是否可按
    ['READY', false, true, false],
    ['RUNNING', false, false, false],
    ['ENDED', true, true, true],
  ])('UT-UI-EXP-01 phase %s 的按鈕可按狀態', (phase, exp, restore, csv) => {
    renderPanel({ phase });
    const b = buttons();
    expect(b.exp.hasAttribute('disabled')).toBe(!exp);
    expect(b.restore.hasAttribute('disabled')).toBe(!restore);
    expect(b.csv.hasAttribute('disabled')).toBe(!csv);
  });

  it('UT-UI-EXP-01 busy=true → 三顆皆 disabled', () => {
    renderPanel({ busy: true });
    const b = buttons();
    expect(b.exp).toBeDisabled();
    expect(b.restore).toBeDisabled();
    expect(b.csv).toBeDisabled();
  });
});
