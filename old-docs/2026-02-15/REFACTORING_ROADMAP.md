# HOA Code Refactoring Roadmap

**Strategic plan for technical improvements across all HOA automation projects**

**Version:** 1.0
**Last Updated:** February 15, 2026
**Status:** Planning

---

## Overview

This roadmap outlines planned improvements to the HOA automation system over the next 3-6 months. Focus is on maintainability, testability, and reducing technical debt while maintaining production stability.

## Guiding Principles

1. **Stability First**: Never break production systems
2. **Incremental Changes**: Small, testable improvements over big rewrites
3. **Document Everything**: Code changes must include documentation updates
4. **Test Before Deploy**: Comprehensive testing for all changes
5. **Backward Compatibility**: Maintain existing integrations during transitions

---

## Current Technical Debt Assessment

### High Priority Issues

**PropertyReport (1,296 lines monolithic)**
- **Issue**: Single file with all logic, difficult to test and maintain
- **Impact**: High - critical production system
- **Risk**: Medium - bugs affect homeowner communications
- **Solution**: Modular refactoring (code already exists in library_project/)

**HOALibrary Version Management**
- **Issue**: No formal version tracking, deployment uses "development mode"
- **Impact**: Medium - breaking changes could affect dependent projects
- **Risk**: Medium - unclear which version is production
- **Solution**: Implement semantic versioning, use published versions

**LabelsToGroups Safety**
- **Issue**: No dry-run mode, direct group modifications
- **Impact**: Medium - could accidentally remove members
- **Risk**: Low - runs infrequently, manual trigger
- **Solution**: Add preview mode, audit logging

**exif-to-parcel Version Control**
- **Issue**: Not tracked in git, changes not documented
- **Impact**: Low - runs manually, single maintainer
- **Risk**: Low - well-tested, stable
- **Solution**: Add git repository, tag releases

### Medium Priority Issues

**PropertyReport Error Handling**
- **Issue**: No retry logic for API failures, limited error recovery
- **Impact**: Medium - form submissions may fail silently
- **Risk**: Low - failures are logged
- **Solution**: Add retry logic, better error notifications

**Keystone Integration Missing**
- **Issue**: Property Report doesn't include HOA system data
- **Impact**: Low - workaround exists (manual lookup)
- **Risk**: None
- **Solution**: Implement Keystone API integration or spreadsheet export

**No Automated Testing**
- **Issue**: All testing is manual, no CI/CD
- **Impact**: Medium - increases deployment risk
- **Risk**: Medium - bugs can reach production
- **Solution**: Add unit tests, integration tests

### Low Priority Issues

**HEIF Image Conversion**
- **Issue**: iPhone HEIC photos require conversion, sometimes fails
- **Impact**: Low - photos still accessible in Drive
- **Risk**: Low - doesn't prevent report generation
- **Solution**: Improve conversion library, add fallbacks

**Documentation Gaps**
- **Issue**: Some edge cases and limitations not documented
- **Impact**: Low - mainly affects new developers
- **Risk**: None
- **Solution**: Ongoing documentation improvements

---

## Refactoring Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Establish version control and release processes

**Tasks:**

1. **Add Git to exif-to-parcel**
   - Initialize repository
   - Create .gitignore (exclude venv/, output/, *.csv logs)
   - Tag current version as v1.0
   - Document git workflow in README
   - **Effort**: 1 hour
   - **Risk**: None

2. **Implement HOALibrary Versioning**
   - Add VERSION constant to library
   - Create formal release process
   - Deploy v4 as published version
   - Update PropertyReport to use v4 (not development)
   - Document version compatibility
   - **Effort**: 2 hours
   - **Risk**: Low (PropertyReport already works with library)

3. **Document Current Architecture**
   - ✅ Already completed: ARCHITECTURE.md created
   - Review and refine based on team feedback
   - **Effort**: Complete
   - **Risk**: None

**Success Criteria:**
- exif-to-parcel has .git/ directory with tagged release
- HOALibrary shows version number when loaded
- PropertyReport uses published HOALibrary v4
- All architecture documentation accurate

---

### Phase 2: Safety and Reliability (Weeks 3-4)

**Goal**: Improve error handling and add safety features

**Tasks:**

1. **Add Dry-Run Mode to LabelsToGroups**
   - Add DRY_RUN flag to CONFIG
   - When enabled, log what would change without making changes
   - Add summary report of planned changes
   - **Effort**: 3 hours
   - **Risk**: Low (additive change)

2. **Improve PropertyReport Error Handling**
   - Add retry logic for Drive API calls (3 retries with exponential backoff)
   - Better error messages in emails to users
   - Send admin notification on critical failures
   - Log all errors to spreadsheet for monitoring
   - **Effort**: 4 hours
   - **Risk**: Low (graceful degradation)

3. **Add Input Validation to PropertyReport**
   - Validate form submission has required fields
   - Standardize address before processing
   - Check homeowner authorization before generating report
   - Fail fast with clear error messages
   - **Effort**: 2 hours
   - **Risk**: Low (prevents bugs)

**Success Criteria:**
- LabelsToGroups can run in preview mode showing changes
- PropertyReport retries failed API calls automatically
- Invalid form submissions caught early with helpful errors
- Error log spreadsheet captures all failures

---

### Phase 3: Modular Architecture (Weeks 5-8)

**Goal**: Migrate PropertyReport to modular library structure

**Context**: Modular version already exists in `~/openclaw.jane/workspace/library_project/property_report/` with 7 separate modules totaling ~1,200 lines.

**Tasks:**

1. **Review Existing Modular Code**
   - Audit library_project/property_report/ modules
   - Identify gaps compared to current v18
   - Update to include v18 bug fixes
   - **Effort**: 2 hours
   - **Risk**: None (review only)

2. **Create Test Suite for Modular Version**
   - Unit tests for each module
   - Integration tests for full workflow
   - Mock form submissions for testing
   - **Effort**: 6 hours
   - **Risk**: None (tests only)

3. **Deploy Modular Version to Test Environment**
   - Create test Apps Script project
   - Deploy modular library modules
   - Link to test form
   - Run comprehensive test matrix
   - **Effort**: 4 hours
   - **Risk**: Low (test environment only)

4. **Parallel Production Testing**
   - Run both monolithic and modular versions on real submissions
   - Compare outputs (PDFs should be identical)
   - Monitor for errors
   - **Effort**: 2 hours setup + 1 week monitoring
   - **Risk**: Low (dual operation)

5. **Production Cutover**
   - Switch production form to modular version
   - Keep monolithic version as backup
   - Monitor closely for 2 weeks
   - **Effort**: 1 hour
   - **Risk**: Medium (production change)

**Rollback Plan:**
- If issues found, revert form trigger to monolithic version
- Fix issues in modular version
- Re-test before second attempt

**Success Criteria:**
- Modular version passes all tests
- Parallel testing shows identical results
- Production cutover successful with no errors
- Code is easier to maintain and extend

---

### Phase 4: Integration and Automation (Weeks 9-12)

**Goal**: Add new features and automation

**Tasks:**

1. **Implement Keystone Integration**
   - Research Keystone API or export options
   - Design integration approach
   - Add owner data to Property Report
   - Test with real data
   - **Effort**: 8 hours
   - **Risk**: Low (additive feature)

2. **Add Automated Testing**
   - Set up clasp for local Apps Script development
   - Add test framework (Google Apps Script testing)
   - Create CI/CD pipeline (optional)
   - **Effort**: 10 hours
   - **Risk**: Low (development process improvement)

3. **Improve exif-to-parcel Accuracy**
   - Analyze REVIEW folder patterns
   - Improve neighbor inference algorithm
   - Add address validation against member list
   - Reduce REVIEW percentage from 5% to 2%
   - **Effort**: 6 hours
   - **Risk**: Low (improves existing process)

4. **Create Deployment Automation**
   - Automate sync between ~/hoa-code/ and Google Drive
   - Add pre-deployment checks
   - Document deployment process
   - **Effort**: 4 hours
   - **Risk**: Low (automation of existing process)

**Success Criteria:**
- Keystone data appears in Property Reports
- Automated tests run on code changes
- exif-to-parcel success rate improves to 95%+
- Deployments documented and partially automated

---

## Priority Matrix

| Project | Issue | Priority | Effort | Risk | Phase |
|---------|-------|----------|--------|------|-------|
| exif-to-parcel | Add git tracking | P1 | Low | None | 1 |
| HOALibrary | Version management | P1 | Low | Low | 1 |
| LabelsToGroups | Dry-run mode | P2 | Low | Low | 2 |
| PropertyReport | Error handling | P2 | Medium | Low | 2 |
| PropertyReport | Input validation | P2 | Low | Low | 2 |
| PropertyReport | Modular refactor | P2 | High | Medium | 3 |
| PropertyReport | Keystone integration | P3 | Medium | Low | 4 |
| All projects | Automated testing | P2 | High | Low | 4 |
| exif-to-parcel | Improve accuracy | P3 | Medium | Low | 4 |

---

## Risk Mitigation

### PropertyReport Production Changes

**Risks:**
- Form submissions could fail
- PDFs could be malformed
- Emails could go to wrong recipients

**Mitigations:**
- Always test with test form first
- Run parallel testing before cutover
- Keep backup version ready to restore
- Monitor logs closely after deployment
- Have rollback plan documented

### API Quota Issues

**Risks:**
- Drive API quota exhausted
- Admin API rate limits hit
- Service account suspended

**Mitigations:**
- Implement exponential backoff
- Add rate limiting to scripts
- Monitor quota usage in Google Cloud Console
- Keep service account credentials secure

### Data Loss or Corruption

**Risks:**
- Spreadsheet data overwritten
- Photos deleted or lost
- Contact groups corrupted

**Mitigations:**
- Never delete, only archive
- Test with copies of data first
- Verify backups exist (Google Sheets versioning)
- Use dry-run modes before live changes

---

## Dependencies and Blockers

### External Dependencies

1. **Google Workspace APIs**
   - Must remain stable (no breaking changes expected)
   - Service account must maintain authorization
   - Domain-wide delegation must remain configured

2. **County GIS Data**
   - Parcels GeoJSON needed for exif-to-parcel
   - Update when county releases new data
   - No control over update schedule

3. **Contractor Photo Format**
   - Assumes GPS-tagged photos with sequence numbers
   - Changes to naming convention would break inference
   - Coordinate with contractors on format

### Internal Dependencies

1. **HOALibrary Stability**
   - PropertyReport depends on it
   - Must test library changes with dependent projects
   - Version pinning required

2. **Form Structure**
   - PropertyReport assumes specific form fields
   - Changes to form require code updates
   - Coordinate form and code changes

---

## Success Metrics

### Phase 1 Metrics
- ✅ Git repository created for exif-to-parcel
- ✅ HOALibrary version number visible
- ✅ PropertyReport using published library version
- ✅ Architecture documented

### Phase 2 Metrics
- LabelsToGroups dry-run mode tested successfully
- PropertyReport error retry working (measure retry rate)
- Input validation catches 100% of invalid submissions
- Error log spreadsheet tracks all failures

### Phase 3 Metrics
- Modular PropertyReport passes all tests
- Parallel testing shows 100% output match
- Production cutover with zero errors
- Code maintainability improved (measure by time to add feature)

### Phase 4 Metrics
- Keystone data in 100% of Property Reports
- Automated tests run on every code change
- exif-to-parcel success rate ≥ 95%
- Deployment time reduced by 50%

---

## Timeline Summary

**Week 1-2 (Phase 1)**: Foundation
- Add version control
- Implement versioning
- ✅ Document architecture

**Week 3-4 (Phase 2)**: Safety
- Dry-run modes
- Error handling improvements
- Input validation

**Week 5-8 (Phase 3)**: Modular Architecture
- Review existing modular code
- Test thoroughly
- Deploy to production

**Week 9-12 (Phase 4)**: Integration
- Keystone integration
- Automated testing
- Process improvements

**Total Duration**: 12 weeks (3 months)

---

## Post-Refactoring Maintenance

### Weekly Tasks
- Review error logs for patterns
- Check API quota usage
- Monitor form submissions

### Monthly Tasks
- Review and update documentation
- Check for Google API updates
- Update dependencies (Python packages)

### Quarterly Tasks
- Review technical debt list
- Plan next refactoring phase
- Update member data and parcel boundaries

---

## Related Documentation

- `ARCHITECTURE.md` - Current system architecture
- `PropertyReport/README.md` - Property Report documentation
- `PropertyReport/KNOWN_ISSUES.md` - Current limitations
- `~/openclaw.jane/workspace/library_project/` - Modular code in development

---

## Questions and Decisions Needed

### Before Phase 3 (Modular Refactor)
- [ ] Confirm modular version includes all v18 functionality
- [ ] Decide on test environment setup
- [ ] Define success criteria for parallel testing
- [ ] Get approval for production cutover timeline

### Before Phase 4 (Keystone Integration)
- [ ] Confirm Keystone API access or export method
- [ ] Define what owner data should appear in reports
- [ ] Verify data privacy compliance

---

## Notes

- **Flexibility**: This roadmap can be adjusted based on priorities and resources
- **Incremental Value**: Each phase delivers value independently
- **Risk Management**: Higher-risk changes happen later after foundation is solid
- **Documentation**: All phases include documentation updates
- **Testing**: Comprehensive testing required before production changes

---

**Maintained By:** Dee Buck
**Next Review:** March 1, 2026
**Status**: Planning complete, ready to begin Phase 1

