import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { ModalDialog } from './ModalDialog';

describe(ModalDialog, () => {
  it('dismisses from the backdrop when configured', async () => {
    const onDismiss = vi.fn<() => void>();
    const screen = await render(
      <ModalDialog dismissal={{ ariaLabel: '关闭测试弹窗', onDismiss }} titleId="test-modal-title">
        <h2 id="test-modal-title">测试弹窗</h2>
      </ModalDialog>,
    );

    await screen.getByRole('button', { name: '关闭测试弹窗' }).click();

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('keeps dismissal disabled during protected work', async () => {
    const onDismiss = vi.fn<() => void>();
    const screen = await render(
      <ModalDialog
        dismissal={{ ariaLabel: '关闭测试弹窗', isDisabled: true, onDismiss }}
        titleId="test-modal-title"
      >
        <h2 id="test-modal-title">测试弹窗</h2>
      </ModalDialog>,
    );

    screen.getByRole('dialog').element().focus();
    await userEvent.keyboard('{Escape}');

    expect(onDismiss).not.toHaveBeenCalled();
    await expect.element(screen.getByRole('button', { name: '关闭测试弹窗' })).toBeDisabled();
  });

  it('omits implicit close controls without a dismissal policy', async () => {
    const screen = await render(
      <ModalDialog titleId="test-modal-title">
        <h2 id="test-modal-title">仅由触发器关闭</h2>
      </ModalDialog>,
    );

    screen.getByRole('dialog').element().focus();
    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).toBeVisible();
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
  });
});
