#!/bin/bash
set -e

echo "=========================================="
echo "Docker Installation Script for Promissio"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script with sudo:"
    echo "sudo bash install-docker.sh"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "Cannot detect OS. This script supports Ubuntu, Debian, CentOS, and Fedora."
    exit 1
fi

echo "Detected OS: $OS $VERSION"
echo ""

# Install Docker based on OS
case $OS in
    ubuntu|debian)
        echo "Installing Docker on Ubuntu/Debian..."
        
        # Update package index
        apt-get update
        
        # Install prerequisites
        apt-get install -y \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        # Add Docker's official GPG key
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        
        # Set up the repository
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
          $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker Engine
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        ;;
        
    centos|rhel|fedora)
        echo "Installing Docker on CentOS/RHEL/Fedora..."
        
        # Install prerequisites
        yum install -y yum-utils
        
        # Set up repository
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        
        # Install Docker Engine
        yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        # Start Docker
        systemctl start docker
        ;;
        
    *)
        echo "Unsupported OS: $OS"
        echo "Please install Docker manually: https://docs.docker.com/engine/install/"
        exit 1
        ;;
esac

# Enable Docker to start on boot
systemctl enable docker

# Verify Docker installation
echo ""
echo "Verifying Docker installation..."
docker --version
docker compose version

# Add current user to docker group (if not root)
if [ -n "$SUDO_USER" ]; then
    echo ""
    echo "Adding user $SUDO_USER to docker group..."
    usermod -aG docker $SUDO_USER
    echo "Note: You'll need to log out and back in for group changes to take effect."
fi

# Test Docker
echo ""
echo "Testing Docker with hello-world..."
docker run --rm hello-world

echo ""
echo "=========================================="
echo "Docker Installation Complete!"
echo "=========================================="
echo ""
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"
echo ""
echo "Next steps:"
echo "1. Log out and log back in (if you're not root)"
echo "2. Navigate to your application directory"
echo "3. Run: cp .env.example .env"
echo "4. Edit .env and set secure passwords"
echo "5. Run: docker-compose up -d"
echo ""
