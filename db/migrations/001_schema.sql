-- HMWSSB Works Management System - Database Schema
-- All tables use PascalCase, no underscores
-- Baseline v1; later migrations in this folder add columns/tables and
-- replace several CHECK constraints (Status, Action, Designation).

CREATE TABLE [Regions] (
  [RegionID] INT PRIMARY KEY IDENTITY(1,1),
  [Name] TEXT NOT NULL
);

CREATE TABLE [Zones] (
  [ZoneID] INT PRIMARY KEY IDENTITY(1,1),
  [RegionID] INT REFERENCES [Regions],
  [Name] TEXT NOT NULL
);

CREATE TABLE [Divisions] (
  [DivisionID] INT PRIMARY KEY IDENTITY(1,1),
  [ZoneID] INT REFERENCES [Zones],
  [Name] TEXT NOT NULL
);

CREATE TABLE [Circles] (
  [CircleID] INT PRIMARY KEY IDENTITY(1,1),
  [DivisionID] INT REFERENCES [Divisions],
  [Name] TEXT NOT NULL
);

CREATE TABLE [Wards] (
  [WardID] INT PRIMARY KEY IDENTITY(1,1),
  [CircleID] INT REFERENCES [Circles],
  [Name] TEXT NOT NULL
);

CREATE TABLE [Sections] (
  [SectionID] INT PRIMARY KEY IDENTITY(1,1),
  [WardID] INT REFERENCES [Wards],
  [Name] TEXT NOT NULL
);

CREATE TABLE [Users] (
  [UserID] INT PRIMARY KEY IDENTITY(1,1),
  [Username] TEXT UNIQUE NOT NULL,
  [PasswordHash] TEXT NOT NULL,
  [Name] TEXT NOT NULL,
  [Designation] TEXT NOT NULL CHECK ([Designation] IN ('Manager','DGM','GM','SoRAdmin')),
  [RegionID] INT REFERENCES [Regions],
  [ZoneID] INT REFERENCES [Zones],
  [DivisionID] INT REFERENCES [Divisions],
  [CircleID] INT REFERENCES [Circles],
  [WardID] INT REFERENCES [Wards],
  [MobileNumber] TEXT,
  [Email] TEXT
);

CREATE TABLE [ItemMaster] (
  [ItemID] INT PRIMARY KEY IDENTITY(1,1),
  [ItemCode] TEXT UNIQUE NOT NULL,
  [Description] TEXT NOT NULL,
  [Unit] TEXT NOT NULL,
  [Category] TEXT NOT NULL CHECK ([Category] IN ('Civil','Material')),
  [FormulaType] TEXT NOT NULL CHECK ([FormulaType] IN ('N','L','LxB','LxBxD','NxL','NxLxBxD')),
  [RateIncludesGST] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1
);

CREATE TABLE [ItemMasterRateHistory] (
  [RateHistoryID] INT PRIMARY KEY IDENTITY(1,1),
  [ItemID] INT REFERENCES [ItemMaster] NOT NULL,
  [Rate] NUMERIC(14,2) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE
);

CREATE TABLE [EstimateHeader] (
  [EstimateID] INT PRIMARY KEY IDENTITY(1,1),
  [WorkID] TEXT UNIQUE NOT NULL,
  [NameOfWork] TEXT NOT NULL,
  [RegionID] INT REFERENCES [Regions],
  [ZoneID] INT REFERENCES [Zones],
  [DivisionID] INT REFERENCES [Divisions],
  [CircleID] INT REFERENCES [Circles],
  [WardID] INT REFERENCES [Wards],
  [SectionID] INT REFERENCES [Sections],
  [WorkCategory] TEXT,
  [WorkType] TEXT,
  [MaterialRequired] BIT NOT NULL DEFAULT 0,
  [GSTPercent] NUMERIC(5,2) NOT NULL DEFAULT 18,
  [LSProvision] NUMERIC(14,2) NOT NULL DEFAULT 0,
  [Status] TEXT NOT NULL DEFAULT 'Draft' CHECK ([Status] IN ('Draft','Submitted','Reverted','Approved')),
  [Version] INT NOT NULL DEFAULT 1,
  [CreatedBy] INT REFERENCES [Users],
  [CreatedDate] TIMESTAMP NOT NULL DEFAULT GETDATE()
);

CREATE TABLE [EstimateDetails] (
  [DetailID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader] NOT NULL,
  [ItemID] INT REFERENCES [ItemMaster] NOT NULL,
  [Category] TEXT NOT NULL,
  [FormulaType] TEXT NOT NULL,
  [N] NUMERIC(10,2),
  [L] NUMERIC(10,2),
  [B] NUMERIC(10,2),
  [D] NUMERIC(10,2),
  [Qty] NUMERIC(14,3) NOT NULL,
  [Unit] TEXT NOT NULL,
  [Rate] NUMERIC(14,2) NOT NULL,
  [Amount] NUMERIC(14,2) NOT NULL,
  [Remarks] TEXT
);

CREATE TABLE [Abstract] (
  [EstimateID] INT PRIMARY KEY REFERENCES [EstimateHeader],
  [CivilTotal] NUMERIC(14,2) NOT NULL,
  [MaterialTotal] NUMERIC(14,2) NOT NULL,
  [CostOfEstimate] NUMERIC(14,2) NOT NULL,
  [GST] NUMERIC(14,2) NOT NULL,
  [LSProvision] NUMERIC(14,2) NOT NULL,
  [GrandTotal] NUMERIC(14,2) NOT NULL
);

CREATE TABLE [Workflow] (
  [WorkflowID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader] NOT NULL,
  [FromUserID] INT REFERENCES [Users],
  [ToUserID] INT REFERENCES [Users],
  [Action] TEXT NOT NULL CHECK ([Action] IN ('Submit','Revert','Approve')),
  [Remarks] TEXT,
  [Version] INT NOT NULL,
  [OTPVerified] BIT NOT NULL DEFAULT 0,
  [DateTime] TIMESTAMP NOT NULL DEFAULT GETDATE(),
  CONSTRAINT [revert_needs_remarks] CHECK ([Action] <> 'Revert' OR [Remarks] IS NOT NULL)
);

CREATE TABLE [Notification] (
  [NotificationID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader],
  [ToUserID] INT REFERENCES [Users],
  [Type] TEXT,
  [Message] TEXT,
  [IsRead] BIT NOT NULL DEFAULT 0,
  [CreatedDate] TIMESTAMP NOT NULL DEFAULT GETDATE()
);

CREATE TABLE [Tender] (
  [TenderID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader],
  [TenderNo] TEXT,
  [TenderDate] DATE,
  [EstimatedCost] NUMERIC(14,2),
  [Status] TEXT
);

CREATE TABLE [Agency] (
  [AgencyID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader],
  [TenderID] INT REFERENCES [Tender],
  [AgencyName] TEXT,
  [AgencyCode] TEXT,
  [AgreementNo] TEXT,
  [AgreementDate] DATE,
  [TenderValue] NUMERIC(14,2),
  [CompletionPeriod] TEXT,
  [SecurityDeposit] NUMERIC(14,2),
  [PerformanceGuarantee] NUMERIC(14,2),
  [ContactDetails] TEXT
);

CREATE TABLE [WorkProgress] (
  [ProgressID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader],
  [Stage] TEXT,
  [Percentage] INT CHECK ([Percentage] IN (0,25,50,75,100)),
  [Remarks] TEXT,
  [Date] DATE
);

CREATE TABLE [Billing] (
  [BillID] INT PRIMARY KEY IDENTITY(1,1),
  [EstimateID] INT REFERENCES [EstimateHeader],
  [BillType] TEXT CHECK ([BillType] IN ('RA','Final')),
  [BillAmount] NUMERIC(14,2),
  [GST] NUMERIC(14,2),
  [NetAmount] NUMERIC(14,2),
  [Status] TEXT
);

-- Indexes
CREATE INDEX idx_estimateheader_status ON [EstimateHeader]([Status]);
CREATE INDEX idx_estimateheader_createdby ON [EstimateHeader]([CreatedBy]);
CREATE INDEX idx_estimatedetails_estimateid ON [EstimateDetails]([EstimateID]);
CREATE INDEX idx_itemmaster_itemcode ON [ItemMaster]([ItemCode]);
CREATE INDEX idx_itemmasterratehistory_itemid ON [ItemMasterRateHistory]([ItemID]);
CREATE INDEX idx_workflow_estimateid ON [Workflow]([EstimateID]);
CREATE INDEX idx_notification_touserid ON [Notification]([ToUserID]);
