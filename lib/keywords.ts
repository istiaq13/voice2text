// Keyword catalogue and pure helpers used by the story generator UI.

export const KEYWORD_CATEGORIES = {
  'E-commerce': ['Shopping Cart', 'Payment', 'Checkout', 'Product Catalog', 'Inventory', 'Order Management', 'Shipping'],
  'Authentication': ['Login', 'Registration', 'Password Reset', 'OAuth', 'Two-Factor Auth', 'Session Management', 'User Roles'],
  'Social Media': ['Posts', 'Comments', 'Likes', 'Shares', 'Follow', 'Messaging', 'Notifications', 'Profile'],
  'Analytics': ['Dashboard', 'Reports', 'Charts', 'Metrics', 'KPIs', 'Data Export', 'Real-time Updates'],
  'Project Management': ['Tasks', 'Projects', 'Teams', 'Deadlines', 'Milestones', 'Kanban Board', 'Time Tracking'],
  'Healthcare': ['Appointments', 'Patients', 'Medical Records', 'Prescriptions', 'Diagnosis', 'Billing', 'Insurance'],
  'Education': ['Courses', 'Students', 'Assignments', 'Grades', 'Exams', 'Enrollment', 'Certifications'],
  'Communication': ['Chat', 'Video Call', 'Email', 'SMS', 'Push Notifications', 'File Sharing', 'Screen Sharing'],
  'AI/ML': ['Machine Learning', 'Natural Language', 'Computer Vision', 'Predictions', 'Training', 'Model Deployment'],
  'Mobile': ['iOS', 'Android', 'Push Notifications', 'Offline Mode', 'Camera', 'GPS', 'Biometrics'],
};

export const ALL_KEYWORDS = Object.values(KEYWORD_CATEGORIES).flat();

// Suggest keywords that literally appear in the requirements text.
export function autoSuggestKeywords(text: string, alreadySelected: string[], limit = 5): string[] {
  const textLower = text.toLowerCase();
  const suggestions: string[] = [];
  for (const keyword of ALL_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase()) && !alreadySelected.includes(keyword)) {
      suggestions.push(keyword);
    }
  }
  return suggestions.slice(0, limit);
}

// Filter the keyword grid by category and search text.
export function filterKeywords(category: string, search: string): string[] {
  let keywords: string[] =
    category === 'All'
      ? ALL_KEYWORDS
      : KEYWORD_CATEGORIES[category as keyof typeof KEYWORD_CATEGORIES] || [];

  if (search.trim()) {
    keywords = keywords.filter((k) => k.toLowerCase().includes(search.toLowerCase()));
  }
  return keywords;
}
