import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { StorageConstruct } from './constructs/storage';
import { DatabaseConstruct } from './constructs/database';
import { AuthConstruct } from './constructs/auth';
import { ApiConstruct } from './constructs/api';
import { FrontendConstruct } from './constructs/frontend';

interface ElementalProStackProps extends cdk.StackProps {
  stage: string;
}

export class ElementalProStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ElementalProStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // VPC - use default or create new
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `elemental-pro-vpc-${stage}`,
      maxAzs: 2,
      natGateways: 1, // Cost optimization: single NAT gateway
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // Lambda Security Group
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Frontend (creates CloudFront first so we can pass domain to other constructs)
    const frontend = new FrontendConstruct(this, 'Frontend', {
      stage,
    });

    // Storage (S3 buckets)
    const storage = new StorageConstruct(this, 'Storage', {
      stage,
      cloudfrontDomain: frontend.distributionDomainName,
    });

    // Database (RDS PostgreSQL)
    const database = new DatabaseConstruct(this, 'Database', {
      stage,
      vpc,
      lambdaSecurityGroup,
    });

    // Auth (Cognito)
    const auth = new AuthConstruct(this, 'Auth', {
      stage,
      cloudfrontDomain: frontend.distributionDomainName,
    });

    // API (Lambda + API Gateway + SQS)
    const api = new ApiConstruct(this, 'Api', {
      stage,
      vpc,
      lambdaSecurityGroup,
      dbSecret: database.secret,
      dbEndpoint: database.cluster.instanceEndpoint.hostname,
      photosBucket: storage.photosBucket,
      pdfsBucket: storage.pdfsBucket,
      cognitoUserPoolId: auth.userPool.userPoolId,
      cognitoRegion: this.region,
      corsOrigin: `https://${frontend.distributionDomainName}`,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'Stage', {
      value: stage,
      description: 'Deployment stage',
    });

    new cdk.CfnOutput(this, 'FullApiUrl', {
      value: `${api.api.url}api`,
      description: 'Full API URL including /api prefix',
    });
  }
}

// Entry point for CDK CLI
const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';

new ElementalProStack(app, `ElementalPro-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'ElementalPro',
    Stage: stage,
    ManagedBy: 'CDK',
  },
});

app.synth();
