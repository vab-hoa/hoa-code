/**
 * Project Registry - Central management of property assessment projects
 */

/**
 * Get all available projects
 * @return {Array} Array of project objects
 */
function getAvailableProjects() {
  return [
    GutterProject,
    WoodTrimProject
    // Future: ConcreteProject, WindowWellProject, etc.
  ];
}

/**
 * Get active projects for report generation
 * @return {Array} Array of active project objects
 */
function getActiveProjects() {
  return getAvailableProjects().filter(project => project.isActive());
}

/**
 * Get project by ID
 * @param {string} projectId - The project identifier
 * @return {Object} Project object or null
 */
function getProjectById(projectId) {
  const projects = getAvailableProjects();
  return projects.find(p => p.id === projectId) || null;
}