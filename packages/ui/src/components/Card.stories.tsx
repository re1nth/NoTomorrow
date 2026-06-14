import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card.js';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    header: "Today's Training",
    children: 'Ship the auth flow. Three tasks, one shipped artifact.',
    footer: 'Round 3 of 7',
  },
};

export const Glove: Story = {
  args: {
    tone: 'glove',
    header: 'Current Round',
    children: 'You are mid-round. Stamina rating up 12 points this week.',
  },
};

export const Knockout: Story = {
  args: {
    tone: 'ko',
    header: 'Cleared',
    children: 'Round 2 stamped. Onward to the next.',
  },
};
