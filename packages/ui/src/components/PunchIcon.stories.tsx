import type { Meta, StoryObj } from '@storybook/react';
import { PunchIcon } from './PunchIcon.js';

const meta: Meta<typeof PunchIcon> = {
  title: 'Components/PunchIcon',
  component: PunchIcon,
  args: { type: 'jab', size: 32 },
};

export default meta;
type Story = StoryObj<typeof PunchIcon>;

export const Jab: Story = {};
export const Hook: Story = { args: { type: 'hook' } };
export const Uppercut: Story = { args: { type: 'uppercut' } };
export const DempseyRoll: Story = { args: { type: 'dempsey_roll' } };

export const AllTypes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <PunchIcon type="jab" size={36} />
      <PunchIcon type="hook" size={36} />
      <PunchIcon type="uppercut" size={36} />
      <PunchIcon type="dempsey_roll" size={36} />
    </div>
  ),
};
