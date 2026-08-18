import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe(Button, () => {
  it('defines default neutral variant and button type', () => {
    const element = Button({ children: 'Cancel' });

    expect(element.type).toBe('button');
    expect(element.props.className).toContain('text-ink-secondary');
    expect(element.props.type).toBe('button');
  });

  it('applies primary variant and custom submit type', () => {
    const element = Button({ children: 'Submit', type: 'submit', variant: 'primary' });

    expect(element.props.className).toContain('bg-accent');
    expect(element.props.type).toBe('submit');
  });

  it('applies danger variant and disabled state', () => {
    const element = Button({ children: 'Delete', disabled: true, variant: 'danger' });

    expect(element.props.className).toContain('bg-danger');
    expect(element.props.disabled).toBeTruthy();
  });
});
