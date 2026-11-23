import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportForm from '../../src/components/ImportForm';
import { appError } from '../helpers/fixtures';

describe('ImportForm', () => {
  it('UT-UI-IMPORT-01 空白輸入（含只有空白字元）→ import-submit disabled', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportForm onImport={onImport} busy={false} />);
    const submit = screen.getByTestId('import-submit');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByTestId('import-input'), '   ');
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(onImport).not.toHaveBeenCalled();

    await userEvent.type(screen.getByTestId('import-input'), 'fixture-template-a');
    expect(submit).toBeEnabled();
  });

  it('UT-UI-IMPORT-03 api 回 HEADER_NOT_FOUND → 顯示表頭格式說明，且不渲染 error-banner', async () => {
    const onImport = vi.fn().mockRejectedValue(appError('HEADER_NOT_FOUND'));
    const { container } = render(<ImportForm onImport={onImport} busy={false} />);
    await userEvent.type(screen.getByTestId('import-input'), 'fixture-template-a');
    await userEvent.click(screen.getByTestId('import-submit'));

    expect(onImport).toHaveBeenCalledWith('fixture-template-a');
    expect(await screen.findByText(/範本格式說明/)).toBeInTheDocument();
    expect(container).toHaveTextContent('題號');
    expect(container).toHaveTextContent('作答');
    expect(container).toHaveTextContent('合併');
    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });

  it('UT-UI-IMPORT-03 以其他錯誤碼拒絕 → 不顯示格式說明', async () => {
    const onImport = vi.fn().mockRejectedValue(appError('SHEETS_NOT_FOUND'));
    render(<ImportForm onImport={onImport} busy={false} />);
    await userEvent.type(screen.getByTestId('import-input'), 'fixture-nope');
    await userEvent.click(screen.getByTestId('import-submit'));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('import-submit')).toBeEnabled();
    expect(screen.queryByText(/範本格式說明/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });

  it('UT-UI-IMPORT-04 importSheet 尚未完成 → disabled 且「匯入中…」，再點不重複呼叫，完成後恢復', async () => {
    let resolve!: (v: unknown) => void;
    const onImport = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(<ImportForm onImport={onImport} busy={false} />);
    await userEvent.type(screen.getByTestId('import-input'), 'fixture-template-a');
    const submit = screen.getByTestId('import-submit');
    expect(submit).toHaveTextContent('匯入');

    await userEvent.click(submit);
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent('匯入中…');
    await userEvent.click(submit);
    expect(onImport).toHaveBeenCalledTimes(1);

    await act(async () => { resolve(undefined); });
    expect(submit).toBeEnabled();
    expect(submit).toHaveTextContent(/^匯入$/);
  });

  it('UT-UI-IMPORT-04 busy 為 true → import-submit disabled', async () => {
    render(<ImportForm onImport={vi.fn()} busy />);
    await userEvent.type(screen.getByTestId('import-input'), 'fixture-template-a');
    expect(screen.getByTestId('import-submit')).toBeDisabled();
  });
});
