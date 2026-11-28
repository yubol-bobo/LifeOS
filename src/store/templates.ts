/**
 * Project templates: a new project that starts with sensible steps already in it.
 * Steps are plain project steps afterwards — rename, delete or add freely.
 */
type T = [string, string];

export interface ProjectTemplate {
  id: string;
  name: T;
  icon: string;
  category: string; // a default category id; falls back to the first category if it's gone
  attr: string; // a default attribute id; falls back to the first attribute
  steps: T[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'paper',
    name: ['写一篇论文', 'Write a paper'],
    icon: 'graduation',
    category: 'research',
    attr: 'mind',
    steps: [
      ['读文献，找到空白', 'Read the literature, find the gap'],
      ['定下问题和方法', 'Settle the question and method'],
      ['做实验 / 收集数据', 'Run experiments / collect data'],
      ['写初稿', 'Write the first draft'],
      ['请人看，改一轮', 'Get feedback, revise'],
      ['投稿', 'Submit'],
    ],
  },
  {
    id: 'skill',
    name: ['学一项新技能', 'Learn a new skill'],
    icon: 'sprout',
    category: 'life',
    attr: 'mind',
    steps: [
      ['定一个具体目标，找好资料', 'Set a concrete goal, gather resources'],
      ['学完基础', 'Get through the basics'],
      ['做一个小作品练手', 'Make a small project with it'],
      ['写下或讲给别人听', 'Write it up or teach someone'],
    ],
  },
  {
    id: 'fitness',
    name: ['健身计划（8 周）', 'Fitness plan (8 weeks)'],
    icon: 'dumbbell',
    category: 'life',
    attr: 'body',
    steps: [
      ['测一次基线（体重、跑步、力量）', 'Measure a baseline (weight, run, strength)'],
      ['定训练计划', 'Plan the training'],
      ['前 4 周', 'Weeks 1–4'],
      ['后 4 周', 'Weeks 5–8'],
      ['复测，对比基线', 'Re-test against the baseline'],
    ],
  },
  {
    id: 'job',
    name: ['找工作', 'Job search'],
    icon: 'briefcase',
    category: 'work',
    attr: 'wealth',
    steps: [
      ['更新简历和作品集', 'Update the CV and portfolio'],
      ['列出目标公司和岗位', 'List target companies and roles'],
      ['投递', 'Apply'],
      ['准备面试', 'Prepare for interviews'],
      ['比较 offer，做决定', 'Compare offers and decide'],
    ],
  },
];
