# codedeploy

Conceptual Overview: The CI/CD Workflow
Here’s a high-level look at how all the pieces fit together:
	1. Developer Pushes Code: A developer makes changes to the application code and pushes them to a specific branch (e.g., main or develop) in a GitHub repository.
	2. CodePipeline Triggers: AWS CodePipeline detects the new commit in the GitHub repository. This automatically triggers the start of the pipeline.
	3. CodeBuild Builds and Pushes to ECR:
		○ AWS CodeBuild pulls the source code from GitHub.
		○ It follows instructions in a buildspec.yml file in your repository to build your application. For containerized applications, this typically involves building a Docker image.
		○ Once the Docker image is built, CodeBuild tags it and pushes it to Amazon Elastic Container Registry (ECR), which is a secure Docker image repository.
	4. CodeDeploy Deploys the Application:
		○ AWS CodeDeploy is triggered by the successful completion of the CodeBuild stage.
		○ It takes the new Docker image from ECR and deploys it to your target environment. This could be a fleet of EC2 instances, an ECS cluster, or even on-premises servers.
		○ CodeDeploy manages the deployment process, handling things like rolling updates, blue/green deployments, and health checks to ensure a safe and reliable release.
This entire process is automated, providing a repeatable and reliable way to get your code from development to production.
Step-by-Step Implementation Guide
Here are the practical steps to set up this CI/CD pipeline:
Step 1: Prerequisites
	• An AWS Account with appropriate IAM permissions.
	• A GitHub Account and a repository containing your application code.
	• Your application should be containerized (i.e., you have a Dockerfile).
	• An EC2 instance (or a fleet of them) with the CodeDeploy agent installed and an appropriate IAM role attached.
Step 2: Create an ECR Repository
	1. Go to the Amazon ECR service in the AWS Console.
	2. Click Create repository.
	3. Give your repository a name (e.g., my-app).
	4. Keep the other settings as default and click Create repository. This is where your Docker images will be stored.
Step 3: Set Up AWS CodeBuild
	1. Navigate to the AWS CodeBuild service.
	2. Click Create build project.
	3. Project Configuration:
		○ Project name: Give it a descriptive name (e.g., my-app-build).
	4. Source:
		○ Source provider: Select GitHub.
		○ Connect to your GitHub account (you may need to authorize AWS).
		○ Repository: Choose your GitHub repository.
	5. Environment:
		○ Environment image: Choose Managed image.
		○ Operating system: Select Amazon Linux 2 or Ubuntu.
		○ Runtime(s): Select Standard.
		○ Image: Choose a recent image version.
		○ Privileged: Check the box for "Privileged" as this is required to build Docker images.
		○ Service role: Let AWS create a new service role for you. This role will need permissions to push to ECR, so you'll edit it later.
	6. Buildspec:
		○ Select Use a buildspec file. This tells CodeBuild to look for a buildspec.yml file in your repository's root directory.
	7. Click Create build project.
Add ECR Permissions to the CodeBuild Role:
	• Go to IAM -> Roles.
	• Find the role that CodeBuild just created (it will have a name like codebuild-my-app-build-service-role).
	• Attach the AmazonEC2ContainerRegistryPowerUser policy to this role. This allows CodeBuild to push images to your ECR repository.
Step 4: Create the buildspec.yml File
In the root of your GitHub repository, create a file named buildspec.yml. This file defines the build commands.
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker image...
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - echo Writing image definitions file...
      - printf '[{"name":"my-container","imageUri":"%s"}]' $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files: imagedefinitions.json
	• Note: You'll need to define the environment variables (AWS_ACCOUNT_ID, AWS_DEFAULT_REGION, IMAGE_REPO_NAME, IMAGE_TAG) in your CodeBuild project settings. IMAGE_TAG can often just be latest or the commit hash.
Step 5: Set Up AWS CodeDeploy
	1. Navigate to the AWS CodeDeploy service.
	2. Applications:
		○ Click Create application.
		○ Application name: my-app-deployment
		○ Compute platform: EC2/On-Premises.
		○ Click Create application.
	3. Deployment Groups:
		○ Inside your new application, click Create deployment group.
		○ Deployment group name: my-app-dg
		○ Service role: Create a new service role that gives CodeDeploy access to your EC2 instances.
		○ Deployment type: Choose In-place or Blue/green.
		○ Environment configuration: Select the EC2 instances by tag (e.g., Name: my-app-server).
		○ Deployment settings: Choose a deployment configuration (e.g., CodeDeployDefault.OneAtATime).
		○ Disable the load balancer for now if you don't have one.
		○ Click Create deployment group.
Step 6: Create the appspec.yml File
In your repository, you also need an appspec.yml file. This tells CodeDeploy what to do on the EC2 instance.
version: 0.0
os: linux
files:
  - source: /
    destination: /var/www/html/my-app # Or wherever your app code should go
hooks:
  BeforeInstall:
    - location: scripts/install_dependencies.sh
      timeout: 300
      runas: root
  ApplicationStart:
    - location: scripts/start_server.sh
      timeout: 300
      runas: root
  ApplicationStop:
    - location: scripts/stop_server.sh
      timeout: 300
      runas: root
You will also need to create the scripts referenced in the hooks (e.g., start_server.sh, which would contain the docker run command to start your container).
Step 7: Create the AWS CodePipeline
This is the final step where you connect everything.
	1. Navigate to the AWS CodePipeline service.
	2. Click Create pipeline.
	3. Pipeline settings:
		○ Pipeline name: my-app-pipeline
		○ Service role: Let AWS create a new one.
	4. Source stage:
		○ Source provider: GitHub (Version 2).
		○ Create a connection to your GitHub account.
		○ Select your repository and the branch you want to trigger the pipeline.
	5. Build stage:
		○ Build provider: AWS CodeBuild.
		○ Select the build project you created earlier.
	6. Deploy stage:
		○ Deploy provider: AWS CodeDeploy.
		○ Select the application and deployment group you created.
	7. Review and Create pipeline.
Now, whenever you push a change to the specified branch in your GitHub repository, the pipeline will automatically trigger, build your Docker image, push it to ECR, and deploy the new version to your EC2 instances.

![image](https://github.com/user-attachments/assets/908d74da-e702-426b-a09a-2460cc7f9609)
