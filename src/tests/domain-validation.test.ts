import { DomainValidationService } from '../services/domain-validation.service';

// Test valid domains
const validDomains = [
  'example.com',
  'www.example.com',
  'blog.example.co.uk',
  'm.example.org',
  'sub.domain.example.net'
];

// Test invalid domains
const invalidDomains = [
  'not-a-domain',
  'example',
  '.com',
  'http:/example.com',
  'example.com/',
  'example..com',
  'example.com..'
];

console.log('Testing domain validation:');
validDomains.forEach(domain => {
  const isValid = DomainValidationService.validateDomain(domain);
  const sanitized = DomainValidationService.sanitizeDomain(domain);
  console.log(`${domain} => ${sanitized || 'Invalid'} (${isValid ? 'Valid' : 'Invalid'})`);
});

console.log('\nTesting invalid domains:');
invalidDomains.forEach(domain => {
  const isValid = DomainValidationService.validateDomain(domain);
  const sanitized = DomainValidationService.sanitizeDomain(domain);
  console.log(`${domain} => ${sanitized || 'Invalid'} (${isValid ? 'Valid' : 'Invalid'})`);
});

// Test batch processing
const batchResult = DomainValidationService.processDomainList([...validDomains, ...invalidDomains]);
console.log('\nBatch processing results:');
console.log(`Valid domains: ${batchResult.validDomains.length}`);
console.log(`Invalid domains: ${batchResult.invalidDomains.length}`);
console.log(`Duplicates: ${batchResult.duplicates.length}`);
console.log('Valid domains:', batchResult.validDomains);
console.log('Invalid domains:', batchResult.invalidDomains);
console.log('Duplicates:', batchResult.duplicates);
