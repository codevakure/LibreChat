#!/bin/bash

# Pleach to Pleach Conversion Script for Windows
# Author: GitHub Copilot
# Date: August 18, 2025
# This script recursively converts all instances of Pleach variations to Pleach

# Color codes for Windows bash
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Statistics counters
declare -i files_processed=0
declare -i files_modified=0
declare -i files_renamed=0
declare -i dirs_renamed=0
declare -i content_replacements=0
declare -i pleach_count=0
declare -i pleach_count=0
declare -i pleach_lower_count=0
declare -i libre_camel_count=0

# Arrays to track changes
declare -a modified_files=()
declare -a renamed_files=()
declare -a renamed_dirs=()

# Function to print colored output
print_header() {
    echo -e "${WHITE}================================================================${NC}"
    echo -e "${WHITE}$1${NC}"
    echo -e "${WHITE}================================================================${NC}"
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_action() {
    echo -e "${BLUE}[ACTION]${NC} $1"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1"
}

print_count() {
    echo -e "${MAGENTA}[COUNT]${NC} $1"
}

# Function to pause and wait for user input
pause_for_user() {
    echo ""
    echo -e "${YELLOW}Press any key to continue...${NC}"
    read -n 1 -s
    echo ""
}

# Function to show progress
show_progress() {
    local current=$1
    local total=$2
    local desc="$3"
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))
    
    printf "\r${BLUE}[PROGRESS]${NC} $desc: ["
    printf "%*s" $filled | tr ' ' '='
    printf "%*s" $empty | tr ' ' '-'
    printf "] %d%% (%d/%d)" $percent $current $total
}

# Function to count instances before replacement
count_instances_in_file() {
    local file="$1"
    local pleach_instances=$(grep -o "Pleach" "$file" 2>/dev/null | wc -l)
    local pleach_instances=$(grep -o "Pleach" "$file" 2>/dev/null | wc -l)
    local pleach_lower_instances=$(grep -o "pleach" "$file" 2>/dev/null | wc -l)
    local libre_camel_instances=$(grep -o "pleach" "$file" 2>/dev/null | wc -l)
    
    pleach_count=$((pleach_count + pleach_instances))
    pleach_count=$((pleach_count + pleach_instances))
    pleach_lower_count=$((pleach_lower_count + pleach_lower_instances))
    libre_camel_count=$((libre_camel_count + libre_camel_instances))
    
    echo $((pleach_instances + pleach_instances + pleach_lower_instances + libre_camel_instances))
}

# Function to get all files for processing (only include text files we want to process)
get_files_to_process() {
    find . -type f \
        -not -path "./.git/*" \
        -not -path "./.github/*" \
        -not -path "./.husky/*" \
        -not -path "./.vscode/*" \
        -not -path "./.devcontainer/*" \
        -not -path "./node_modules/*" \
        -not -path "./data-node/*" \
        -not -path "./meili_data_v1.12/*" \
        -not -path "./logs/*" \
        -not -path "./api/logs/*" \
        -not -path "./uploads/*" \
        -not -path "./dist/*" \
        -not -path "./build/*" \
        -not -path "./.next/*" \
        -not -path "./coverage/*" \
        -not -path "./.nyc_output/*" \
        -not -path "./temp/*" \
        -not -path "./tmp/*" \
        -not -path "./.cache/*" \
        -not -path "./public/dist/*" \
        -not -path "./client/dist/*" \
        -not -path "./api/dist/*" \
        -not -path "./redis-config/*" \
        -not -path "./helm/*" \
        -not -path "./e2e/*" \
        -not -name "*.wt" \
        -not -name "*.lock" \
        -not -name "*.lockb" \
        -not -name "package-lock.json" \
        -not -name "yarn.lock" \
        -not -name "pnpm-lock.yaml" \
        -not -name "bun.lockb" \
        -not -name "*.min.js" \
        -not -name "*.min.css" \
        -not -name "*.map" \
        \( \
            -name "*.js" -o \
            -name "*.jsx" -o \
            -name "*.ts" -o \
            -name "*.tsx" -o \
            -name "*.json" -o \
            -name "*.md" -o \
            -name "*.txt" -o \
            -name "*.yml" -o \
            -name "*.yaml" -o \
            -name "*.css" -o \
            -name "*.scss" -o \
            -name "*.html" -o \
            -name "*.htm" -o \
            -name "*.xml" -o \
            -name ".env*" -o \
            -name "*.config.*" -o \
            -name "Dockerfile*" -o \
            -name "*.sh" -o \
            -name "*.bat" -o \
            -name "*.ps1" -o \
            -name "*.py" -o \
            -name "*.php" -o \
            -name "README*" -o \
            -name "LICENSE*" -o \
            -name "CHANGELOG*" -o \
            -name "CONTRIBUTING*" -o \
            -name ".gitignore" -o \
            -name ".dockerignore" -o \
            -name "*.cjs" -o \
            -name "*.mjs" -o \
            -name "*.vue" \
        \)
}

# Function to scan and count all instances
scan_workspace() {
    print_header "SCANNING WORKSPACE FOR INSTANCES"
    
    print_status "Getting list of files to process (excluding node_modules, dist, etc.)..."
    local all_files
    mapfile -t all_files < <(get_files_to_process)
    local total_files=${#all_files[@]}
    
    print_status "Found $total_files files to scan"
    print_status "Scanning for instances of Pleach variations..."
    echo ""
    
    # Use more efficient batch processing
    files_processed=$total_files
    
    # Count all instances efficiently using grep
    print_action "Counting 'Pleach' instances..."
    pleach_count=$(grep -r "Pleach" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=data-node \
        --exclude-dir=meili_data_v1.12 \
        --exclude-dir=logs \
        --exclude-dir=uploads \
        --exclude-dir=dist \
        --exclude-dir=build \
        --exclude-dir=.next \
        --exclude-dir=coverage \
        --exclude-dir=.nyc_output \
        --exclude-dir=temp \
        --exclude-dir=tmp \
        --exclude-dir=.cache \
        --exclude="*.lock*" \
        --exclude="*.min.*" \
        --exclude="*.map" \
        --exclude="*.wt" \
        --binary-files=without-match 2>/dev/null | wc -l)
    
    print_action "Counting 'Pleach' instances..."
    pleach_count=$(grep -r "Pleach" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=data-node \
        --exclude-dir=meili_data_v1.12 \
        --exclude-dir=logs \
        --exclude-dir=uploads \
        --exclude-dir=dist \
        --exclude-dir=build \
        --exclude-dir=.next \
        --exclude-dir=coverage \
        --exclude-dir=.nyc_output \
        --exclude-dir=temp \
        --exclude-dir=tmp \
        --exclude-dir=.cache \
        --exclude="*.lock*" \
        --exclude="*.min.*" \
        --exclude="*.map" \
        --exclude="*.wt" \
        --binary-files=without-match 2>/dev/null | wc -l)
    
    print_action "Counting 'pleach' instances..."
    pleach_lower_count=$(grep -r "pleach" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=data-node \
        --exclude-dir=meili_data_v1.12 \
        --exclude-dir=logs \
        --exclude-dir=uploads \
        --exclude-dir=dist \
        --exclude-dir=build \
        --exclude-dir=.next \
        --exclude-dir=coverage \
        --exclude-dir=.nyc_output \
        --exclude-dir=temp \
        --exclude-dir=tmp \
        --exclude-dir=.cache \
        --exclude="*.lock*" \
        --exclude="*.min.*" \
        --exclude="*.map" \
        --exclude="*.wt" \
        --binary-files=without-match 2>/dev/null | wc -l)
    
    print_action "Counting 'pleach' instances..."
    libre_camel_count=$(grep -r "pleach" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=data-node \
        --exclude-dir=meili_data_v1.12 \
        --exclude-dir=logs \
        --exclude-dir=uploads \
        --exclude-dir=dist \
        --exclude-dir=build \
        --exclude-dir=.next \
        --exclude-dir=coverage \
        --exclude-dir=.nyc_output \
        --exclude-dir=temp \
        --exclude-dir=tmp \
        --exclude-dir=.cache \
        --exclude="*.lock*" \
        --exclude="*.min.*" \
        --exclude="*.map" \
        --exclude="*.wt" \
        --binary-files=without-match 2>/dev/null | wc -l)
    
    content_replacements=$((pleach_count + pleach_count + pleach_lower_count + libre_camel_count))
    
    echo ""
    print_count "Pleach instances: $pleach_count"
    print_count "Pleach instances: $pleach_count"
    print_count "pleach instances: $pleach_lower_count"
    print_count "pleach instances: $libre_camel_count"
    print_count "Total content instances: $content_replacements"
    
    # Count files and directories that need renaming
    print_action "Counting files and directories to rename..."
    local files_to_rename=$(find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./data-node/*" | grep -i "pleach" | wc -l)
    local dirs_to_rename=$(find . -type d -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./data-node/*" | grep -i "pleach" | wc -l)
    
    print_count "Files to rename: $files_to_rename"
    print_count "Directories to rename: $dirs_to_rename"
    
    echo ""
    print_success "Scan complete! Much faster now that we're using optimized grep."
}

# Function to replace content in files
replace_content_in_files() {
    print_header "REPLACING CONTENT IN FILES"
    
    local all_files
    mapfile -t all_files < <(get_files_to_process)
    local total_files=${#all_files[@]}
    local current=0
    
    print_status "Processing $total_files files for content replacement..."
    echo ""
    
    for file in "${all_files[@]}"; do
        current=$((current + 1))
        show_progress $current $total_files "Processing files"
        
        if [ -f "$file" ] && [ -r "$file" ]; then
            # Check if file contains any of our target strings
            if grep -l "Pleach\|pleach\|pleach\|Pleach" "$file" 2>/dev/null >/dev/null; then
                # Create temporary file for replacements
                local temp_file=$(mktemp)
                
                # Perform replacements in specific order (most specific first to avoid conflicts)
                sed 's/Pleach/Pleach/g; s/Pleach/Pleach/g; s/pleach/pleach/g; s/pleach/pleach/g' "$file" > "$temp_file"
                
                # Check if changes were made
                if ! cmp -s "$file" "$temp_file"; then
                    mv "$temp_file" "$file"
                    files_modified=$((files_modified + 1))
                    modified_files+=("$file")
                else
                    rm "$temp_file"
                fi
            fi
        fi
    done
    
    echo "" # New line after progress
    echo ""
    print_success "Content replacement completed!"
    print_count "Files modified: $files_modified"
}

# Function to rename files
rename_files() {
    print_header "RENAMING FILES"
    
    # Get all files that need renaming
    local files_to_rename
    mapfile -t files_to_rename < <(find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./data-node/*" | grep -i "pleach")
    
    local total_files=${#files_to_rename[@]}
    local current=0
    
    if [ $total_files -eq 0 ]; then
        print_status "No files to rename."
        return
    fi
    
    print_status "Found $total_files files to rename..."
    echo ""
    
    for file in "${files_to_rename[@]}"; do
        current=$((current + 1))
        show_progress $current $total_files "Renaming files"
        
        # Get directory and filename
        local dir=$(dirname "$file")
        local filename=$(basename "$file")
        
        # Create new filename with replacements (case insensitive approach)
        local new_filename=$(echo "$filename" | sed 's/Libre[[:space:]]Chat/Pleach/gi; s/Pleach/Pleach/g; s/pleach/pleach/g; s/pleach/pleach/gi')
        
        if [ "$filename" != "$new_filename" ]; then
            local new_path="$dir/$new_filename"
            
            # Make sure target doesn't exist
            if [ ! -e "$new_path" ]; then
                mv "$file" "$new_path" 2>/dev/null
                if [ $? -eq 0 ]; then
                    files_renamed=$((files_renamed + 1))
                    renamed_files+=("$filename -> $new_filename")
                fi
            fi
        fi
    done
    
    echo "" # New line after progress
    echo ""
    print_success "File renaming completed!"
    print_count "Files renamed: $files_renamed"
}

# Function to rename directories
rename_directories() {
    print_header "RENAMING DIRECTORIES"
    
    # Get all directories that need renaming (deepest first)
    local dirs_to_rename
    mapfile -t dirs_to_rename < <(find . -type d -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./data-node/*" | grep -i "pleach" | sort -r)
    
    local total_dirs=${#dirs_to_rename[@]}
    local current=0
    
    if [ $total_dirs -eq 0 ]; then
        print_status "No directories to rename."
        return
    fi
    
    print_status "Found $total_dirs directories to rename..."
    echo ""
    
    for dir in "${dirs_to_rename[@]}"; do
        current=$((current + 1))
        show_progress $current $total_dirs "Renaming directories"
        
        # Get parent directory and directory name
        local parent_dir=$(dirname "$dir")
        local dir_name=$(basename "$dir")
        
        # Create new directory name with replacements
        local new_dir_name=$(echo "$dir_name" | sed 's/Libre[[:space:]]Chat/Pleach/gi; s/Pleach/Pleach/g; s/pleach/pleach/g; s/pleach/pleach/gi')
        
        if [ "$dir_name" != "$new_dir_name" ]; then
            local new_path="$parent_dir/$new_dir_name"
            
            # Make sure target doesn't exist
            if [ ! -e "$new_path" ]; then
                mv "$dir" "$new_path" 2>/dev/null
                if [ $? -eq 0 ]; then
                    dirs_renamed=$((dirs_renamed + 1))
                    renamed_dirs+=("$dir_name -> $new_dir_name")
                fi
            fi
        fi
    done
    
    echo "" # New line after progress
    echo ""
    print_success "Directory renaming completed!"
    print_count "Directories renamed: $dirs_renamed"
}

# Function to show detailed summary
show_detailed_summary() {
    print_header "DETAILED CONVERSION SUMMARY"
    
    echo -e "${WHITE}Content Replacements:${NC}"
    print_count "Pleach → Pleach: $pleach_count instances"
    print_count "Pleach → Pleach: $pleach_count instances"
    print_count "pleach → pleach: $pleach_lower_count instances"
    print_count "pleach → pleach: $libre_camel_count instances"
    print_count "Total content instances replaced: $content_replacements"
    
    echo ""
    echo -e "${WHITE}File Operations:${NC}"
    print_count "Total files processed: $files_processed"
    print_count "Files with content modified: $files_modified"
    print_count "Files renamed: $files_renamed"
    print_count "Directories renamed: $dirs_renamed"
    
    if [ ${#modified_files[@]} -gt 0 ] && [ ${#modified_files[@]} -le 20 ]; then
        echo ""
        echo -e "${WHITE}Modified Files:${NC}"
        for file in "${modified_files[@]}"; do
            echo -e "${CYAN}  ✓ $file${NC}"
        done
    elif [ ${#modified_files[@]} -gt 20 ]; then
        echo ""
        echo -e "${WHITE}Modified Files: ${CYAN}${#modified_files[@]} files (too many to list)${NC}"
    fi
    
    if [ ${#renamed_files[@]} -gt 0 ]; then
        echo ""
        echo -e "${WHITE}Renamed Files:${NC}"
        for rename in "${renamed_files[@]}"; do
            echo -e "${YELLOW}  📝 $rename${NC}"
        done
    fi
    
    if [ ${#renamed_dirs[@]} -gt 0 ]; then
        echo ""
        echo -e "${WHITE}Renamed Directories:${NC}"
        for rename in "${renamed_dirs[@]}"; do
            echo -e "${MAGENTA}  📁 $rename${NC}"
        done
    fi
    
    echo ""
    if git status --porcelain | grep -q .; then
        echo -e "${WHITE}Git Status:${NC}"
        local modified_count=$(git status --porcelain | grep "^ M" | wc -l)
        local renamed_count=$(git status --porcelain | grep "^R" | wc -l)
        local added_count=$(git status --porcelain | grep "^A" | wc -l)
        local deleted_count=$(git status --porcelain | grep "^D" | wc -l)
        local untracked_count=$(git status --porcelain | grep "^??" | wc -l)
        
        print_count "Modified files in git: $modified_count"
        print_count "Renamed files in git: $renamed_count"
        print_count "Added files in git: $added_count"
        print_count "Deleted files in git: $deleted_count"
        print_count "Untracked files in git: $untracked_count"
    else
        print_warning "No changes detected by git."
    fi
}

# Function to show menu and handle user choices
show_menu() {
    while true; do
        echo ""
        print_header "POST-CONVERSION OPTIONS"
        echo -e "${WHITE}Choose an option:${NC}"
        echo -e "${CYAN}1.${NC} View git diff"
        echo -e "${CYAN}2.${NC} View git status"
        echo -e "${CYAN}3.${NC} Stage all changes (git add .)"
        echo -e "${CYAN}4.${NC} Commit changes"
        echo -e "${CYAN}5.${NC} Show detailed file list"
        echo -e "${CYAN}6.${NC} Show conversion summary again"
        echo -e "${CYAN}7.${NC} Exit"
        echo ""
        echo -n "Enter your choice (1-7): "
        read -n 1 choice
        echo ""
        
        case $choice in
            1)
                echo ""
                print_action "Showing git diff..."
                git diff --stat
                pause_for_user
                ;;
            2)
                echo ""
                print_action "Showing git status..."
                git status
                pause_for_user
                ;;
            3)
                echo ""
                print_action "Staging all changes..."
                git add .
                print_success "All changes staged!"
                pause_for_user
                ;;
            4)
                echo ""
                echo -n "Enter commit message (or press Enter for default): "
                read commit_message
                if [ -z "$commit_message" ]; then
                    commit_message="Convert Pleach to Pleach - automated conversion"
                fi
                git commit -m "$commit_message"
                print_success "Changes committed!"
                pause_for_user
                ;;
            5)
                echo ""
                print_action "Showing detailed file changes..."
                git status --porcelain
                pause_for_user
                ;;
            6)
                show_detailed_summary
                pause_for_user
                ;;
            7)
                print_success "Exiting script. Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please choose 1-7."
                ;;
        esac
    done
}

# Main execution function
main() {
    # Clear screen for better presentation
    clear
    
    print_header "PLEACH TO PLEACH CONVERSION SCRIPT"
    echo -e "${WHITE}This script will recursively convert:${NC}"
    echo -e "${CYAN}• Pleach → Pleach${NC}"
    echo -e "${CYAN}• pleach → pleach${NC}"
    echo -e "${CYAN}• pleach → pleach${NC}"
    echo -e "${CYAN}• Pleach → Pleach${NC}"
    echo ""
    echo -e "${WHITE}In:${NC}"
    echo -e "${CYAN}• File contents${NC}"
    echo -e "${CYAN}• File names${NC}"
    echo -e "${CYAN}• Directory names${NC}"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository. Please run this script from the root of your git repository."
        echo ""
        echo "Press any key to exit..."
        read -n 1 -s
        exit 1
    fi
    
    # Get the root directory of the git repository
    local repo_root=$(git rev-parse --show-toplevel)
    cd "$repo_root"
    
    print_status "Working in repository: $repo_root"
    
    echo ""
    echo -e "${YELLOW}⚠️  WARNING: This operation will modify many files!${NC}"
    echo -e "${YELLOW}⚠️  Make sure you have committed or backed up your current work.${NC}"
    echo ""
    echo -n "Do you want to continue? (y/N): "
    read -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled by user."
        echo "Press any key to exit..."
        read -n 1 -s
        exit 0
    fi
    
    # Create a backup branch
    print_action "Creating backup branch..."
    local backup_branch="backup-before-pleach-conversion-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$backup_branch" > /dev/null 2>&1
    git checkout - > /dev/null 2>&1
    print_success "Backup branch created: $backup_branch"
    
    echo ""
    pause_for_user
    
    # Step 1: Scan workspace
    scan_workspace
    pause_for_user
    
    # Step 2: Replace content in files
    replace_content_in_files
    pause_for_user
    
    # Step 3: Rename files
    rename_files
    pause_for_user
    
    # Step 4: Rename directories
    rename_directories
    pause_for_user
    
    # Step 5: Show detailed summary
    show_detailed_summary
    
    print_header "CONVERSION COMPLETED SUCCESSFULLY!"
    print_success "Backup branch: $backup_branch"
    print_success "Total instances converted: $content_replacements"
    print_success "Files modified: $files_modified"
    print_success "Files renamed: $files_renamed"
    print_success "Directories renamed: $dirs_renamed"
    
    # Step 6: Show interactive menu
    show_menu
}

# Trap Ctrl+C to allow graceful exit
trap 'echo ""; print_warning "Script interrupted by user."; echo "Press any key to exit..."; read -n 1 -s; exit 1' INT

# Run the main function
main

# This line should never be reached due to the menu loop, but just in case
print_status "Script execution completed."
echo "Press any key to exit..."
read -n 1 -s
