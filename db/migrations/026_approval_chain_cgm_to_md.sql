-- Phase 1: Complete the approval chain CGM → DOP → ED → MD → FinalApproved
-- Adds new statuses and updates the CHECK constraint on EstimateHeader.Status

-- 1. Add new status values to the CHECK constraint
ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "EstimateHeader_Status_check";

ALTER TABLE "EstimateHeader" ADD CONSTRAINT "EstimateHeader_Status_check"
  CHECK ("Status" IN (
    'Draft', 'Submitted', 'Reverted',
    'DGM_Approved',
    'GM_Recommended',
    'CGM_Submitted',
    'DOP_Approved',
    'ED_Approved',
    'MD_Approved',
    'FinalApproved',
    'Signed',
    'TenderPublished', 'AgencySelected',
    'WorkStarted', 'WorkCompleted',
    'Billing', 'Completed'
  ));

-- 2. Add new action values to the Workflow Action CHECK constraint
ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "Workflow_Action_check";

ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_Action_check"
  CHECK ("Action" IN (
    'Submit', 'Revert', 'Approve', 'Recommend', 'SubmitForApproval',
    'ApproveAtDOP', 'ApproveAtED', 'FinalApprove',
    'DigitallySign', 'Sign', 'Complete',
    'PublishTender', 'SelectAgency', 'StartWork', 'CompleteWork',
    'SubmitBill', 'Archive'
  ));

-- 3. Migrate existing Signed estimates to GM_Recommended if they haven't
--    progressed to tender yet (optional — protects data during transition)
-- NOTE: Only migrate if there are Signed estimates without tenders.
-- This is safe because the new flow makes GM_Recommended → CGM the path.
-- Existing Signed estimates that already have tenders should remain Signed.
