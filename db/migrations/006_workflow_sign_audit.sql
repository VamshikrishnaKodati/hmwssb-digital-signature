-- HMWSSB - v6: Separate "Digitally Sign & Audit" workflow step
-- Adds a distinct Signed status after GM approval, and allows the DigitallySign action.

ALTER TABLE "EstimateHeader" DROP CONSTRAINT IF EXISTS "EstimateHeader_Status_check";
ALTER TABLE "EstimateHeader" ADD CONSTRAINT "EstimateHeader_Status_check"
  CHECK ("Status" IN (
    'Draft','Submitted','Reverted',
    'DGM_Approved','Approved','Signed',
    'TenderPublished','AgencySelected',
    'WorkStarted','WorkCompleted',
    'Billing','Completed'
  ));

ALTER TABLE "Workflow" DROP CONSTRAINT IF EXISTS "Workflow_Action_check";
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_Action_check"
  CHECK ("Action" IN (
    'Submit','Revert','Approve','DigitallySign','Recommend','Sign','Complete',
    'PublishTender','SelectAgency','StartWork','CompleteWork','SubmitBill','Archive'
  ));
