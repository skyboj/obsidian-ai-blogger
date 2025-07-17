---
title: blog
subtitle: subtitle
description:
publish: true
created_date: <% tp.date.now %>
featured_image: URL
slug:
tags:
  - obsidian
  - AI
  - Self-improvement
---
```yaml
---
# Required Properties
title: blog                    # Required: Used for SEO meta title and as the main heading
publish: true                  # Required: Set to 'true' to make the post public

# Optional Properties
subtitle:                      # Optional: Secondary title shown below the main title
description:                   # Optional: Used for SEO meta description and blog card previews
                              # Recommended length: 150-160 characters
created_date: # Optional: Post creation date (auto-generated)
featured_image:                # Optional: URL of the main image
                              # - Displayed at the top of the post
                              # - Used for social media cards
                              # - Used for SEO image meta tags
slug:                         # Optional: Custom URL path
                              # - If not specified, auto-generated from title
                              # - Format: lowercase-with-hyphens
tags:                         # Optional: Categories/topics for the post
  - obsidian                  # - Used for post filtering and navigation
  - AI                        # - Helps with content organization
  - Self-improvement          # - Improves searchability
---

<!-- Start writing your blog post content here -->



```