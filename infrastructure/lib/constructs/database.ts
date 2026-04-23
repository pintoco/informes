import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DatabaseConstructProps {
  stage: string;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseConstruct extends Construct {
  public readonly cluster: rds.DatabaseInstance;
  public readonly secret: secretsmanager.Secret;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const { stage, vpc, lambdaSecurityGroup } = props;

    // Database security group
    this.securityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // Allow Lambda to connect to RDS
    this.securityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to PostgreSQL'
    );

    // DB credentials secret
    this.secret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `elemental-pro/${stage}/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    // Subnet group (use private subnets)
    const subnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', {
      description: 'Subnet group for Elemental Pro RDS',
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // RDS PostgreSQL instance
    this.cluster = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.securityGroup],
      subnetGroup,
      databaseName: 'elemental_pro',
      credentials: rds.Credentials.fromSecret(this.secret),
      multiAz: stage === 'prod',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention:
        stage === 'prod' ? cdk.Duration.days(7) : cdk.Duration.days(1),
      deletionProtection: stage === 'prod',
      removalPolicy:
        stage === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      publiclyAccessible: false,
      enablePerformanceInsights: stage === 'prod',
    });

    // Outputs
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.cluster.instanceEndpoint.hostname,
      description: 'RDS instance endpoint',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.secret.secretArn,
      description: 'ARN of the database credentials secret',
    });
  }
}
