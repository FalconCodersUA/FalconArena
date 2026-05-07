const UK_WEEK_LABELS: Record<string, string> = {
  mon: 'Пн',
  monday: 'Пн',
  tue: 'Вт',
  tuesday: 'Вт',
  wed: 'Ср',
  wednesday: 'Ср',
  thu: 'Чт',
  thursday: 'Чт',
  fri: 'Пт',
  friday: 'Пт',
  sat: 'Сб',
  saturday: 'Сб',
  sun: 'Нд',
  sunday: 'Нд',
};

export function localizeWeekLabels(labels: string[], language: string) {
  if (language !== 'uk') {
    return labels;
  }

  return labels.map((label) => UK_WEEK_LABELS[label.trim().toLowerCase()] ?? label);
}
