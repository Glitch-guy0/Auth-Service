# AuthService UML Diagrams

This directory contains Mermaid diagrams for the AuthService project. These diagrams can be imported into Excalidraw for visualization and editing.

## Diagram Index

### Sequence Diagrams
| File | Description | Maps to FRs |
|------|-------------|-------------|
| `01-sequence-registration.mmd` | User registration flow | FR-1, FR-5, FR-13 |
| `02-sequence-login.mmd` | User login flow | FR-2, FR-5, FR-6, FR-13, FR-15 |
| `03-sequence-refresh.mmd` | Token refresh flow | FR-3, FR-6, FR-7 |
| `04-sequence-logout.mmd` | User logout flow | FR-4, FR-25 |

### Class Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `05-class-entities.mmd` | Entity relationships (User, RefreshToken, UserDemographics) | FR-13, FR-23, FR-24, FR-25 |
| `06-class-services.mmd` | Service hierarchy and interfaces | Hexagonal Architecture |
| `07-class-exceptions.mmd` | Exception hierarchy | Section 11.1 |

### Component Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `08-component-hexagonal.mmd` | Hexagonal architecture layers | Section 11.4 |

### Package Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `09-package-modules.mmd` | Module dependencies and folder structure | Section 11.4, 11.5 |

### Object Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `10-object-runtime.mmd` | Runtime instances during auth flow | Runtime state |

## How to Use with Excalidraw

1. **Import Mermaid diagrams:**
   - Open Excalidraw
   - Click `+` → `Mermaid to Excalidraw`
   - Paste the `.mmd` file content
   - Click "Create"

2. **Edit diagrams:**
   - Drag and drop elements
   - Add notes and annotations
   - Export as PNG/SVG

## Diagram Conventions

- **Green** = Inbound adapters (HTTP, Guards)
- **Blue** = Ports (Interfaces)
- **Orange** = Core domain (Services)
- **Purple** = Outbound adapters (Databases)
- **Red** = Root configuration
- **Gray** = Infrastructure (Config, Validation)

## Related Documentation

- [PRD](../../_bmad-output/planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md)
- [Architecture](../../_bmad-output/planning-artifacts/architecture.md)
- [Technical Documentation](../../_bmad-output/planning-artifacts/technical-documentation.md)
