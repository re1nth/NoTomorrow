import type { Meta, StoryObj } from '@storybook/react';
import { RatingSparkline } from './RatingSparkline.js';

const meta: Meta<typeof RatingSparkline> = {
  title: 'Components/RatingSparkline',
  component: RatingSparkline,
  args: {
    values: [1200, 1210, 1190, 1220, 1240, 1235, 1280, 1305],
    width: 160,
    height: 40,
  },
};

export default meta;
type Story = StoryObj<typeof RatingSparkline>;

export const Climbing: Story = {};

export const Falling: Story = {
  args: { values: [1400, 1380, 1350, 1330, 1300, 1290, 1240], color: '#8E2A1F' },
};

export const Flat: Story = {
  args: { values: [1200, 1198, 1202, 1199, 1201, 1200, 1200], filled: false },
};

export const Sparse: Story = { args: { values: [1200] } };
