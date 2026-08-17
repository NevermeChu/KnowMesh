import { StarterKit } from '@tiptap/starter-kit';
import { Callout } from './extensions/CalloutExtension';
import { Details, DetailsContent, DetailsSummary } from './extensions/DetailsExtension';
import { TaskItem, TaskList } from './extensions/TaskListExtension';

export const documentExtensions = [
  StarterKit,
  Callout,
  Details,
  DetailsSummary,
  DetailsContent,
  TaskList,
  TaskItem,
];
