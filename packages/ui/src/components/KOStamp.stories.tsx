import type { Meta, StoryObj } from '@storybook/react';
import { KOStamp } from './KOStamp.js';

const meta: Meta<typeof KOStamp> = {
  title: 'Components/KOStamp',
  component: KOStamp,
  args: {
    active: true,
    size: 160,
  },
};

export default meta;
type Story = StoryObj<typeof KOStamp>;

export const Default: Story = {};

export const LottieMode: Story = { args: { lottie: true } };

export const CustomLabel: Story = { args: { label: 'WIN', size: 200 } };
