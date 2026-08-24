import { StarterKit } from '@tiptap/starter-kit';
import { BlockDragDropExtension } from './extensions/BlockDragDropExtension';
import { Callout } from './extensions/CalloutExtension';
import { Details, DetailsContent, DetailsSummary } from './extensions/DetailsExtension';
import { TaskItem, TaskList } from './extensions/TaskListExtension';

export const documentNodeExtensions = [
  Callout,
  Details,
  DetailsSummary,
  DetailsContent,
  TaskList,
  TaskItem,
];

export const documentExtensions = [
  StarterKit.configure({
    dropcursor: false,
  }),
  BlockDragDropExtension,
  ...documentNodeExtensions,
];
