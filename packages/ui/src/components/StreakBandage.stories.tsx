import type { Meta, StoryObj } from '@storybook/react';
import { StreakBandage } from './StreakBandage.js';

const meta: Meta<typeof StreakBandage> = {
  title: 'Components/StreakBandage',
  component: StreakBandage,
  args: { days: 5 },
};

export default meta;
type Story = StoryObj<typeof StreakBandage>;

export const ShortStreak: Story = {};
export const NoStreak: Story = { args: { days: 0 } };
export const LongStreak: Story = { args: { days: 42 } };
export const Tall: Story = { args: { days: 12, height: 32 } };
