export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  pin?: string; // Users can set a personal PIN to secure their account on first login
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Done';
export type TaskPriority = 'low' | 'med' | 'high';

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  ownerId: string; // The primary person responsible
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD format or empty
  assistingIds: string[]; // List of other team member IDs contributing
  dependencies: string[]; // List of task IDs this task is blocked by
  waitingPersonId?: string; // Who gets notified when the blocker is cleared (defaults to ownerId)
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export const TEAM: TeamMember[] = [
  { id: 'karan', name: 'Karan', email: 'Karan@printstop.co.in', phone: '7738099974' },
  { id: 'dipak', name: 'Dipak', email: 'Sourcing@printstop.co.in', phone: '9930801420' },
  { id: 'pundalik', name: 'Pundalik', email: 'sourcing1@printstop.co.in', phone: '7045682294' },
  { id: 'pratiksha', name: 'Pratiksha', email: 'sourcing2@printstop.co.in', phone: '9820683120' },
  { id: 'savijjith', name: 'Savijjith (Myself)', email: 'savijjith@printstop.co.in', phone: '9167332254' },
  { id: 'prakash', name: 'Prakash', email: 'grn@printstop.co.in', phone: '8655848859' },
];
