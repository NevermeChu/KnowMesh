import { describe, expect, it } from 'vitest';
import { Kbd } from './Kbd';

describe(Kbd, () => {
  it('renders kbd element with surface background by default', () => {
    const element = Kbd({ children: '⌘K' });

    expect(element.type).toBe('kbd');
    expect(element.props.className).toContain('bg-surface');
    expect(element.props.children).toBe('⌘K');
  });

  it('renders card background when specified', () => {
    const element = Kbd({ children: 'ESC', surface: 'card' });

    expect(element.props.className).toContain('bg-card');
  });
});
