# Microsoft 365 Security Assessment Report

**Prepared For:** {{ customer_name }}

**Tenant ID:** {{ tenant_id }}

**Assessment Date:** {{ assessment_date }}

**Prepared By:** {{ team_name }}

---

## Executive Summary

{{ team_name }} conducted a comprehensive security assessment of {{ customer_name }}'s Microsoft 365 environment. This assessment evaluated security configurations against CISA Secure Cloud Business Applications (SCuBA) baselines and industry best practices.

### Overall Security Posture

**Security Score: {{ security_score }}%**

{% if security_score >= 80 %}
The organization demonstrates a strong security posture with most controls properly configured. Focus remediation efforts on the remaining high-priority items identified below.
{% elif security_score >= 60 %}
The organization has foundational security controls in place but significant gaps remain that could be exploited by threat actors. Prioritized remediation is recommended.
{% elif security_score >= 40 %}
The organization's security posture requires substantial improvement. Multiple critical and high-severity gaps were identified that pose significant risk.
{% else %}
The organization's Microsoft 365 environment has critical security gaps that require immediate attention. The current configuration leaves the environment vulnerable to common attack vectors.
{% endif %}

### Score Movement
{% if score_movement.available %}
**Previous Score:** {{ score_movement.previous_score }}% ({{ score_movement.previous_assessment_date }})

**Current Score:** {{ score_movement.current_score }}%

**Change:** {{ score_movement.delta_signed }} points

{{ score_movement.message }}
{% else %}
{{ score_movement.message }}
{% endif %}

### Risk Summary

The assessment identified the following distribution of security findings:

| Severity | Failed Controls |
|----------|-----------------|
| Critical | {{ counts.critical }} |
| High | {{ counts.high }} |
| Medium | {{ counts.medium }} |
| Low | {{ counts.low }} |

**Total Controls Assessed:** {{ total_findings }}

**Controls Passing:** {{ passed_count }}

**Controls Failing:** {{ failed_count }}

### Priority Areas

Based on the assessment findings, the following areas require immediate attention:

{% for theme in priority_themes %}
1. **{{ theme.title }}** — {{ theme.failed_count }} finding(s) at {{ theme.risk_level | capitalize }} risk
{% endfor %}

---

## Remediation Roadmap

The following roadmap prioritizes remediation activities based on risk severity and potential business impact:

| Priority | Focus Area | Timeline | Risk Level | Findings |
|----------|------------|----------|------------|----------|
{% for item in roadmap %}
| {{ item.priority }} | {{ item.theme }} | {{ item.window }} | {{ item.risk_level | capitalize }} | {{ item.failed_count }} |
{% endfor %}

### Priority Definitions

- **Now (0-30 days):** Critical and high-risk items that should be addressed immediately. These represent the highest risk to the organization and are often targeted in initial access attacks.

- **Next (30-60 days):** Medium-risk items that should be addressed after immediate priorities. These items represent meaningful security improvements.

- **Later (60-90 days):** Lower-risk items and security hardening opportunities. While lower priority, these should not be ignored as they contribute to defense in depth.

---

## Detailed Findings

{% for theme in themes %}
### {{ theme.title }}

**Priority:** {{ theme.priority }} ({{ theme.window }})

**Risk Level:** {{ theme.risk_level | capitalize }}

**Pass Rate:** {{ theme.pass_rate }}%

**Failed/Applicable:** {{ theme.failed_findings | length }}/{{ theme.findings | length }}

#### Why This Matters

{{ theme.business_rationale }}

#### Business Impact

{{ theme.business_impact }}

#### Recommendation Summary

{{ theme.recommendation_summary }}

#### Remediation Steps

{% for step in theme.remediation_steps %}
{{ loop.index }}. {{ step }}
{% endfor %}

#### Operational Considerations

{% for note in theme.operational_notes %}
- {{ note }}
{% endfor %}

#### Assessment Results

| Control | Status | Severity |
|---------|--------|----------|
{% for finding in theme.findings %}
| {{ finding.title[:70] }}{% if finding.title | length > 70 %}...{% endif %} | {{ finding.status | capitalize }} | {{ finding.severity | capitalize }} |
{% endfor %}

{% if theme.failed_findings | length > 0 %}
#### Failed Controls Requiring Action

{% for finding in theme.failed_findings %}
**{{ finding.title }}**

- Severity: {{ finding.severity | capitalize }}
- Control ID: {{ finding.control_id }}
{% if finding.recommendation %}- Recommendation: {{ finding.recommendation }}{% endif %}

{% endfor %}
{% endif %}

---

{% endfor %}

## Appendix A: Assessment Methodology

### Tool

This assessment was performed using ScubaGear, developed by the Cybersecurity and Infrastructure Security Agency (CISA). ScubaGear evaluates Microsoft 365 tenant configurations against the Secure Cloud Business Applications (SCuBA) security baselines.

### Scope

The following Microsoft 365 workloads were assessed:

- Azure Active Directory / Entra ID
- Exchange Online
- Microsoft Defender for Office 365
- SharePoint Online
- OneDrive for Business
- Microsoft Teams
- Power Platform

### Scoring Methodology

The security score is calculated using a weighted pass ratio methodology:

| Severity Level | Weight |
|----------------|--------|
| Critical | 10 |
| High | 7 |
| Medium | 4 |
| Low | 1 |
| Informational | 0 |

**Formula:** Score = (Sum of weights for passed controls ÷ Sum of weights for all applicable controls) × 100

Controls marked as "Not Applicable" are excluded from the scoring calculation.

---

## Appendix B: Glossary

- **MFA:** Multi-Factor Authentication - An authentication method requiring two or more verification factors.
- **PIM:** Privileged Identity Management - Azure AD feature for just-in-time privileged access.
- **Conditional Access:** Azure AD feature for defining access policies based on conditions like location, device state, and risk level.
- **SPF:** Sender Policy Framework - Email authentication method to prevent sender address forgery.
- **DKIM:** DomainKeys Identified Mail - Email authentication method using digital signatures.
- **DMARC:** Domain-based Message Authentication, Reporting & Conformance - Email authentication policy and reporting protocol.
- **ATP:** Advanced Threat Protection - Microsoft Defender features for protecting against sophisticated threats.

---

## Appendix C: References

- [CISA SCuBA Project](https://www.cisa.gov/scuba)
- [Microsoft 365 Security Documentation](https://docs.microsoft.com/en-us/microsoft-365/security/)
- [Azure AD Security Best Practices](https://docs.microsoft.com/en-us/azure/active-directory/fundamentals/concept-fundamentals-security-defaults)

---

*This report was generated by m365-assess on {{ assessment_date }}.*

*Assessment ID: {{ run.id }}*
