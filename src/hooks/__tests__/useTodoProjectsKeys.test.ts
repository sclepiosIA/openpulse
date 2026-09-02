import { describe, it, expect } from 'vitest';
import { todoProjectKeys } from '../tasks/useTodoProjects';

describe('todoProjectKeys', () => {
  it('all is base key', () => {
    expect(todoProjectKeys.all).toEqual(['todo-projects']);
  });

  it('list extends all', () => {
    const key = todoProjectKeys.list();
    expect(key).toEqual(['todo-projects', 'list']);
  });

  it('detail includes id', () => {
    const key = todoProjectKeys.detail('abc-123');
    expect(key).toEqual(['todo-projects', 'detail', 'abc-123']);
  });

  it('detail with different ids are different', () => {
    const k1 = todoProjectKeys.detail('a');
    const k2 = todoProjectKeys.detail('b');
    expect(k1).not.toEqual(k2);
  });

  it('list starts with all', () => {
    const list = todoProjectKeys.list();
    expect(list.slice(0, 1)).toEqual(todoProjectKeys.all);
  });

  it('detail starts with all', () => {
    const detail = todoProjectKeys.detail('x');
    expect(detail.slice(0, 1)).toEqual(todoProjectKeys.all);
  });
});
