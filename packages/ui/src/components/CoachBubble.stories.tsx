import type { Meta, StoryObj } from '@storybook/react';
import { CoachBubble } from './CoachBubble.js';

const meta: Meta<typeof CoachBubble> = {
  title: 'Components/CoachBubble',
  component: CoachBubble,
  args: {
    children: 'Show me what you got today. No excuses.',
    name: 'Coach',
    tone: 'stern',
  },
};

export default meta;
type Story = StoryObj<typeof CoachBubble>;

export const Stern: Story = {};
export const Hype: Story = { args: { tone: 'hype', children: 'That last round — chefs kiss. Keep pushing.' } };
export const Analytical: Story = {
  args: {
    tone: 'analytical',
    children: 'Stamina up 30 pts week-over-week. Expertise flat. Tighten the proofs.',
  },
};
export const Warm: Story = { args: { tone: 'warm', children: 'Rough week. Tomorrow we go again.' } };
export const RightSide: Story = { args: { side: 'right', name: 'You', tone: 'analytical', children: 'Shipped.' } };
