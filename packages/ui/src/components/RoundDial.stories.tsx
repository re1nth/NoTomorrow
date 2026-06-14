import type { Meta, StoryObj } from '@storybook/react';
import { RoundDial } from './RoundDial.js';

const meta: Meta<typeof RoundDial> = {
  title: 'Components/RoundDial',
  component: RoundDial,
  args: { value: 0.6, label: 'R3', sublabel: '60%' },
};

export default meta;
type Story = StoryObj<typeof RoundDial>;

export const Partial: Story = {};

export const Empty: Story = { args: { value: 0, label: 'R1', sublabel: '0%' } };

export const Complete: Story = { args: { value: 1, label: 'R3', sublabel: 'DONE' } };

export const Large: Story = { args: { size: 160, stroke: 12 } };
