import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe(Badge, () => {
  it('renders neutral badge with small size by default', () => {
    const element = Badge({ children: 'Tag' });

    expect(element.type).toBe('span');
    expect(element.props.className).toContain('bg-overlay');
    expect(element.props.className).toContain('text-[11px]');
  });

  it('renders accent badge with dot indicator', () => {
    const element = Badge({ children: 'Active', dot: true, variant: 'accent' });

    expect(element.props.className).toContain('bg-accent-soft');
    expect(element.props.children[0]?.props.className).toContain('bg-accent');
    expect(element.props.children[1]).toBe('Active');
  });
});
