import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { BellRing } from './BellRing.js';

const meta: Meta<typeof BellRing> = {
  title: 'Components/BellRing',
  component: BellRing,
};

export default meta;
type Story = StoryObj<typeof BellRing>;

export const Idle: Story = { args: { ringing: false, size: 40 } };

export const Ringing: Story = { args: { ringing: true, size: 40 } };

export const Interactive: Story = {
  render: () => {
    const [ringing, setRinging] = useState(false);
    return (
      <button
        type="button"
        onClick={() => setRinging((r) => !r)}
        className="inline-flex items-center gap-3"
      >
        <BellRing ringing={ringing} size={48} />
        <span>Click to toggle</span>
      </button>
    );
  },
};
